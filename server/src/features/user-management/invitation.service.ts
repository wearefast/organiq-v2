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
    clerkOrgId: string,
    invitingMemberId: string,
    inviterClerkUserId: string,
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

    // Send invitation email via Clerk (fire-and-forget — failure logged, not thrown)
    this.sendClerkInviteEmail(
      invitation.token,
      dto.email,
      dto.role,
      clerkOrgId,
      inviterClerkUserId,
    ).catch((err: Error) => {
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
   * Send invitation email via Clerk's organization invitation API.
   * Clerk handles email delivery — no external email provider needed.
   * The redirectUrl points to our custom accept page so our DB flow runs on accept.
   */
  private async sendClerkInviteEmail(
    token: string,
    toEmail: string,
    role: string,
    clerkOrgId: string,
    inviterClerkUserId: string,
  ) {
    const secretKey = this.config.get<string>('CLERK_SECRET_KEY');
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'https://app.rankorganiq.com';

    if (!secretKey) {
      this.logger.warn('CLERK_SECRET_KEY not configured — invitation email skipped');
      return;
    }

    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey });

    const clerkRole = role === 'admin' ? 'org:admin' : 'org:member';
    const redirectUrl = `${frontendUrl}/invite/${token}`;

    await clerk.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      emailAddress: toEmail,
      inviterUserId: inviterClerkUserId,
      role: clerkRole,
      redirectUrl,
    });

    this.logger.log(`Clerk invitation email sent to ${toEmail}`);
  }
}
