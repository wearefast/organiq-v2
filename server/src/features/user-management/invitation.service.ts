import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import {
  invitations,
  orgMembers,
  accessGrants,
  organizations,
  workspaces,
  projects,
} from '../../db/schema';
import { CreateInvitationDto, AccessGrantSpec } from './dto/create-invitation.dto';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  /** Invitations expire after 7 days */
  private static readonly EXPIRY_DAYS = 7;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  // ─── Create ──────────────────────────────────────────────────────────────────

  /**
   * Create a new invitation and send the invite email.
   * Only callable by an admin member of the org.
   */
  async create(
    orgId: string,
    invitingMemberId: string,
    dto: CreateInvitationDto,
  ) {
    // Validate email is not already an active member
    const existing = await this.db.db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.organizationId, orgId), eq(orgMembers.email, dto.email)),
      columns: { id: true },
    });
    if (existing) {
      throw new BadRequestException('This email address is already a member of the organization');
    }

    // Prevent duplicate pending invitations for the same email
    const pendingInvite = await this.db.db.query.invitations.findFirst({
      where: and(
        eq(invitations.organizationId, orgId),
        eq(invitations.email, dto.email),
        eq(invitations.status, 'pending'),
      ),
      columns: { id: true },
    });
    if (pendingInvite) {
      throw new BadRequestException(
        'A pending invitation for this email already exists. Revoke it before re-inviting.',
      );
    }

    // Normalise grants: treat empty array the same as omitted (default to org-level)
    const grants =
      !dto.accessGrants || dto.accessGrants.length === 0
        ? [{ type: 'org' as const }]
        : dto.accessGrants;

    // Validate discriminated union shape before hitting the DB
    for (const grant of grants) {
      if (grant.type === 'workspace' && !('workspaceId' in grant && grant.workspaceId)) {
        throw new BadRequestException('Workspace grant requires a workspaceId');
      }
      if (
        grant.type === 'project' &&
        (!('workspaceId' in grant && grant.workspaceId) ||
          !('projectId' in grant && grant.projectId))
      ) {
        throw new BadRequestException('Project grant requires both workspaceId and projectId');
      }
    }

    // Validate all referenced workspace/project IDs exist in this org
    await this.validateGrantScopes(orgId, grants);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + InvitationService.EXPIRY_DAYS);

    // Generate a cryptographically secure token
    const token = crypto.randomUUID();

    const [invitation] = await this.db.db
      .insert(invitations)
      .values({
        organizationId: orgId,
        invitedByMemberId: invitingMemberId,
        email: dto.email,
        role: dto.role,
        status: 'pending',
        token,
        accessGrants: grants,
        expiresAt,
      })
      .returning();

    // Send invitation email (fire-and-forget — failure logged, not thrown)
    this.sendInviteEmail(invitation.token, dto.email, orgId).catch((err: Error) => {
      this.logger.error(`Failed to send invitation email to ${dto.email}: ${err.message}`);
    });

    return invitation;
  }

  // ─── Accept ──────────────────────────────────────────────────────────────────

  /**
   * Accept an invitation. Called after the invitee signs in via Clerk.
   *
   * Atomically:
   *   1. Marks invitation as accepted
   *   2. Creates org_members row
   *   3. Creates access_grants rows from invitation.accessGrants
   *
   * Returns the org record for frontend redirect.
   */
  async accept(token: string, clerkUserId: string, email: string) {
    const invitation = await this.db.db.query.invitations.findFirst({
      where: eq(invitations.token, token),
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    // Pre-transaction status/expiry checks (fast-fail; definitive check is inside tx)
    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Invitation is ${invitation.status}`);
    }
    if (invitation.expiresAt < new Date()) {
      await this.db.db
        .update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, invitation.id));
      throw new BadRequestException('This invitation has expired');
    }

    // Verify the accepting user's email matches the invited email (IDOR prevention)
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenException('This invitation was issued to a different email address');
    }

    // Run atomically
    const member = await this.db.db.transaction(async (tx) => {
      // 1. Mark invitation accepted — conditional on status still being 'pending'
      //    to handle concurrent accept attempts (race condition guard).
      const [acceptedInvitation] = await tx
        .update(invitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(and(eq(invitations.id, invitation.id), eq(invitations.status, 'pending')))
        .returning();

      if (!acceptedInvitation) {
        throw new BadRequestException(
          'Invitation was already accepted or revoked by a concurrent request',
        );
      }

      // 2. Create org member (idempotent: user may already be a member via another path)
      const memberResult = await tx
        .insert(orgMembers)
        .values({
          organizationId: invitation.organizationId,
          clerkUserId,
          email,
          role: invitation.role as 'admin' | 'user',
        })
        .onConflictDoNothing()
        .returning();

      let newMember = memberResult[0];
      if (!newMember) {
        // Member already existed; fetch them
        const existing = await tx.query.orgMembers.findFirst({
          where: and(
            eq(orgMembers.organizationId, invitation.organizationId),
            eq(orgMembers.clerkUserId, clerkUserId),
          ),
        });
        if (existing) newMember = existing;
      }
      if (!newMember) throw new Error('Failed to resolve member after invitation accept');

      // 3. Create access grants from invitation spec
      //    grantedByMemberId = the admin who sent the invite (may be null if they left)
      const grantRows = (invitation.accessGrants as AccessGrantSpec[]).map((g) => ({
        organizationId: invitation.organizationId,
        memberId: newMember!.id,
        grantType: g.type as 'org' | 'workspace' | 'project',
        workspaceId: 'workspaceId' in g ? g.workspaceId : undefined,
        projectId: 'projectId' in g ? g.projectId : undefined,
        grantedByMemberId: invitation.invitedByMemberId ?? newMember!.id,
      }));

      if (grantRows.length > 0) {
        // Simple bulk insert — validateGrantScopes() already confirmed existence.
        // If a workspace/project was deleted in the sub-millisecond window between
        // validation and this insert, the FK violation aborts the transaction cleanly
        // (all-or-nothing). The caller retries the accept.
        for (const row of grantRows) {
          await tx.insert(accessGrants).values(row).onConflictDoNothing();
        }
      }

      return newMember;
    });

    // Return org info for frontend redirect
    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, invitation.organizationId),
      columns: { id: true, name: true, slug: true },
    });

    return { member, org };
  }

  // ─── Revoke ──────────────────────────────────────────────────────────────────

  /**
   * Revoke a pending invitation. Only callable by an admin of the org.
   */
  async revoke(invitationId: string, orgId: string, revokingMemberId: string) {
    const invitation = await this.db.db.query.invitations.findFirst({
      where: and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId)),
    });

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending') {
      throw new BadRequestException(`Cannot revoke an invitation with status '${invitation.status}'`);
    }

    const [updated] = await this.db.db
      .update(invitations)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
        revokedByMemberId: revokingMemberId,
      })
      .where(eq(invitations.id, invitationId))
      .returning();

    return updated;
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async listByOrg(orgId: string) {
    return this.db.db.query.invitations.findMany({
      where: eq(invitations.organizationId, orgId),
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    });
  }

  // ─── Token lookup (public accept page) ───────────────────────────────────────

  /**
   * Look up an invitation by token (for the public accept page to preview details).
   * Returns only safe, non-sensitive fields.
   */
  async findByToken(token: string) {
    const invitation = await this.db.db.query.invitations.findFirst({
      where: eq(invitations.token, token),
      columns: {
        id: true,
        organizationId: true, // needed for org name lookup; excluded from response below
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        accessGrants: true,
      },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, invitation.organizationId),
      columns: { name: true, slug: true },
    });

    // Exclude organizationId from the public response
    const { organizationId: _omit, ...safeInvitation } = invitation;
    return { ...safeInvitation, organizationName: org?.name };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Validate that all referenced workspaceIds and projectIds exist in the org.
   * Throws BadRequestException with details on the first invalid scope.
   */
  private async validateGrantScopes(orgId: string, grants: AccessGrantSpec[]) {
    const workspaceIds = grants
      .filter((g): g is { type: 'workspace'; workspaceId: string } => g.type === 'workspace')
      .map((g) => g.workspaceId);

    const projectIds = grants
      .filter((g): g is { type: 'project'; workspaceId: string; projectId: string } =>
        g.type === 'project',
      )
      .map((g) => g.projectId);

    if (workspaceIds.length > 0) {
      const found = await this.db.db.query.workspaces.findMany({
        where: and(
          eq(workspaces.organizationId, orgId),
          inArray(workspaces.id, workspaceIds),
        ),
        columns: { id: true },
      });
      const foundIds = new Set(found.map((w) => w.id));
      const missing = workspaceIds.find((id) => !foundIds.has(id));
      if (missing) {
        throw new BadRequestException(`Workspace ${missing} does not belong to this organization`);
      }
    }

    if (projectIds.length > 0) {
      const found = await this.db.db.query.projects.findMany({
        where: and(
          eq(projects.organizationId, orgId),
          inArray(projects.id, projectIds),
        ),
        columns: { id: true },
      });
      const foundIds = new Set(found.map((p) => p.id));
      const missing = projectIds.find((id) => !foundIds.has(id));
      if (missing) {
        throw new BadRequestException(`Project ${missing} does not belong to this organization`);
      }
    }
  }

  /**
   * Send invitation email via SendGrid.
   */
  private async sendInviteEmail(token: string, toEmail: string, orgId: string) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    const fromEmail =
      this.config.get<string>('EMAIL_FROM') ?? 'invitations@rankorganiq.com';
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://app.rankorganiq.com';

    if (!apiKey) {
      this.logger.warn('SENDGRID_API_KEY not configured — invitation email skipped');
      return;
    }

    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { name: true },
    });

    const orgName = org?.name ?? 'your team';
    const inviteUrl = `${frontendUrl}/invite/${token}`;

    const html = this.buildInviteEmailHtml(orgName, inviteUrl);

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: 'Pulse OS' },
        subject: `You've been invited to join ${orgName} on Pulse`,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      throw new Error(`SendGrid error: ${response.status} ${response.statusText}`);
    }

    this.logger.log(`Invitation email sent to ${toEmail}`);
  }

  private buildInviteEmailHtml(orgName: string, inviteUrl: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="margin-bottom:32px">
      <span style="font-size:22px;font-weight:700;color:#111">Pulse OS</span>
    </div>
    <h1 style="font-size:20px;font-weight:600;color:#111;margin:0 0 12px">
      You've been invited to join <em>${orgName}</em>
    </h1>
    <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 28px">
      Someone on the <strong>${orgName}</strong> team has invited you to collaborate on Pulse OS — the SEO content intelligence platform.
    </p>
    <a href="${inviteUrl}"
       style="display:inline-block;background:#111;color:#fff;font-size:15px;font-weight:600;
              padding:12px 28px;border-radius:8px;text-decoration:none">
      Accept Invitation
    </a>
    <p style="font-size:13px;color:#888;margin:28px 0 0;line-height:1.5">
      This invitation expires in ${InvitationService.EXPIRY_DAYS} days.<br>
      If you weren't expecting this, you can safely ignore this email.
    </p>
    <p style="font-size:12px;color:#bbb;margin:16px 0 0">
      Or copy this link: <a href="${inviteUrl}" style="color:#666">${inviteUrl}</a>
    </p>
  </div>
</body>
</html>`;
  }
}
