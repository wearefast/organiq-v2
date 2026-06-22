import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { accessGrants, orgMembers, workspaces, projects } from '../../db/schema';
import { AccessGrantSpec } from './dto/create-invitation.dto';

@Injectable()
export class AccessGrantService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Get all access grants for a member in an org.
   */
  async getMemberGrants(memberId: string, orgId: string) {
    return this.db.db.query.accessGrants.findMany({
      where: and(
        eq(accessGrants.memberId, memberId),
        eq(accessGrants.organizationId, orgId),
      ),
    });
  }

  /**
   * Replace a member's access grants with a new set.
   * Runs in a transaction: deletes existing grants, inserts new ones.
   * Validates all referenced workspaceIds and projectIds exist in the org.
   */
  async replaceGrants(
    orgId: string,
    memberId: string,
    grantingMemberId: string,
    newGrants: AccessGrantSpec[],
  ) {
    // Validate referenced resource IDs (outside tx — read-only, idempotent)
    await this.validateGrantScopes(orgId, newGrants);

    await this.db.db.transaction(async (tx) => {
      // Acquire an exclusive row lock on the member row to serialise concurrent
      // replaceGrants calls for the same member (prevents last-write-wins data loss).
      const [lockedMember] = await tx
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.id, memberId), eq(orgMembers.organizationId, orgId)))
        .for('update');

      if (!lockedMember) throw new NotFoundException('Member not found in this organization');

      // Delete all existing grants for this member in this org
      await tx
        .delete(accessGrants)
        .where(and(eq(accessGrants.memberId, memberId), eq(accessGrants.organizationId, orgId)));

      // Insert new grants (skip if empty — user gets no access)
      if (newGrants.length > 0) {
        await tx.insert(accessGrants).values(
          newGrants.map((g) => ({
            organizationId: orgId,
            memberId,
            grantType: g.type as 'org' | 'workspace' | 'project',
            workspaceId: 'workspaceId' in g ? g.workspaceId : undefined,
            projectId: 'projectId' in g ? g.projectId : undefined,
            grantedByMemberId: grantingMemberId,
          })),
        );
      }
    });

    return this.getMemberGrants(memberId, orgId);
  }

  /**
   * Get all members of an org with their current access grants, enriched with workspace/project names.
   */
  async getMembersWithGrants(orgId: string) {
    const members = await this.db.db.query.orgMembers.findMany({
      where: eq(orgMembers.organizationId, orgId),
      with: {
        grants: {
          where: eq(accessGrants.organizationId, orgId),
        },
      },
    });

    // Enrich grants with workspace/project names
    const enriched = await Promise.all(
      members.map(async (member) => ({
        ...member,
        grants: await Promise.all(
          member.grants.map(async (grant) => {
            if (grant.grantType === 'org') {
              return { ...grant, workspaceName: null, projectName: null };
            }
            if (grant.grantType === 'workspace' && grant.workspaceId) {
              const ws = await this.db.db.query.workspaces.findFirst({
                where: eq(workspaces.id, grant.workspaceId),
                columns: { name: true },
              });
              return { ...grant, workspaceName: ws?.name ?? null, projectName: null };
            }
            if (grant.grantType === 'project' && grant.projectId) {
              const proj = await this.db.db.query.projects.findFirst({
                where: eq(projects.id, grant.projectId),
                columns: { name: true },
              });
              const ws = grant.workspaceId
                ? await this.db.db.query.workspaces.findFirst({
                    where: eq(workspaces.id, grant.workspaceId),
                    columns: { name: true },
                  })
                : null;
              return { ...grant, workspaceName: ws?.name ?? null, projectName: proj?.name ?? null };
            }
            return grant;
          }),
        ),
      })),
    );
    return enriched;
  }

  /**
   * Remove a member from the org.
   * ON DELETE CASCADE on access_grants.member_id handles grant cleanup automatically.
   */
  async removeMember(orgId: string, memberId: string) {
    const [deleted] = await this.db.db
      .delete(orgMembers)
      .where(and(eq(orgMembers.id, memberId), eq(orgMembers.organizationId, orgId)))
      .returning({ id: orgMembers.id });

    if (!deleted) throw new NotFoundException('Member not found');
    return deleted;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

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
        where: and(eq(workspaces.organizationId, orgId), inArray(workspaces.id, workspaceIds)),
        columns: { id: true },
      });
      const foundIds = new Set(found.map((w) => w.id));
      const missing = workspaceIds.find((id) => !foundIds.has(id));
      if (missing) throw new BadRequestException(`Workspace ${missing} not found in this org`);
    }

    if (projectIds.length > 0) {
      const found = await this.db.db.query.projects.findMany({
        where: and(eq(projects.organizationId, orgId), inArray(projects.id, projectIds)),
        columns: { id: true },
      });
      const foundIds = new Set(found.map((p) => p.id));
      const missing = projectIds.find((id) => !foundIds.has(id));
      if (missing) throw new BadRequestException(`Project ${missing} not found in this org`);
    }
  }
}
