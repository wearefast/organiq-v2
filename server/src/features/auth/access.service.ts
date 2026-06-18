import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { accessGrants, projects } from '../../db/schema';

@Injectable()
export class AccessService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Check whether a member has access to a resource.
   *
   * Access rules:
   *   - 'org' grant  → access to everything in the org
   *   - 'workspace' grant → access to that workspace and all its projects
   *   - 'project' grant  → access to that specific project only
   *
   * Pass workspaceId and/or projectId depending on the resource being accessed.
   * When only projectId is known, the caller should resolve the project's workspaceId
   * first (AccessGuard does this automatically).
   */
  async hasAccess(
    memberId: string,
    orgId: string,
    workspaceId?: string | null,
    projectId?: string | null,
  ): Promise<boolean> {
    const grants = await this.db.db.query.accessGrants.findMany({
      where: and(
        eq(accessGrants.memberId, memberId),
        eq(accessGrants.organizationId, orgId),
      ),
      columns: { grantType: true, workspaceId: true, projectId: true },
    });

    for (const grant of grants) {
      if (grant.grantType === 'org') return true;
      if (
        grant.grantType === 'workspace' &&
        workspaceId &&
        grant.workspaceId === workspaceId
      ) {
        return true;
      }
      if (
        grant.grantType === 'project' &&
        projectId &&
        grant.projectId === projectId
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolve the workspaceId for a given projectId.
   * Used by AccessGuard when only projectId is in route params.
   */
  async resolveProjectWorkspace(
    projectId: string,
    orgId: string,
  ): Promise<string | null> {
    const project = await this.db.db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.organizationId, orgId)),
      columns: { workspaceId: true },
    });
    return project?.workspaceId ?? null;
  }

  /**
   * Check whether a member has any grant at all in the org (for org-scope checks).
   */
  async hasAnyGrant(memberId: string, orgId: string): Promise<boolean> {
    const grant = await this.db.db.query.accessGrants.findFirst({
      where: and(
        eq(accessGrants.memberId, memberId),
        eq(accessGrants.organizationId, orgId),
      ),
      columns: { id: true },
    });
    return grant !== undefined;
  }

  /**
   * Return the set of workspace IDs a member can access, or `null` meaning "all".
   *
   * null       → member has an org-level grant, every workspace is accessible
   * string[]   → only these workspace IDs are accessible (may be empty)
   *
   * Workspace access is granted by:
   *   - An 'org' grant
   *   - A 'workspace' grant on that workspace
   *   - A 'project' grant on a project that belongs to that workspace
   */
  async getAccessibleWorkspaceIds(
    memberId: string,
    orgId: string,
  ): Promise<string[] | null> {
    const grants = await this.db.db.query.accessGrants.findMany({
      where: and(
        eq(accessGrants.memberId, memberId),
        eq(accessGrants.organizationId, orgId),
      ),
      columns: { grantType: true, workspaceId: true, projectId: true },
    });

    if (grants.some((g) => g.grantType === 'org')) return null;

    const wsIds = new Set<string>();

    for (const g of grants) {
      if (g.grantType === 'workspace' && g.workspaceId) {
        wsIds.add(g.workspaceId);
      }
    }

    // For project grants, resolve the parent workspace
    const projectGrantIds = grants
      .filter((g) => g.grantType === 'project' && g.projectId)
      .map((g) => g.projectId as string);

    if (projectGrantIds.length > 0) {
      const rows = await this.db.db.query.projects.findMany({
        where: and(
          eq(projects.organizationId, orgId),
          inArray(projects.id, projectGrantIds),
        ),
        columns: { workspaceId: true },
      });
      for (const r of rows) wsIds.add(r.workspaceId);
    }

    return [...wsIds];
  }

  /**
   * Return the set of project IDs a member can access within a workspace,
   * or `null` meaning "all projects in that workspace".
   *
   * null       → member has org-level or workspace-level grant for this workspace
   * string[]   → only these project IDs (may be empty)
   */
  async getAccessibleProjectIds(
    memberId: string,
    orgId: string,
    workspaceId: string,
  ): Promise<string[] | null> {
    const grants = await this.db.db.query.accessGrants.findMany({
      where: and(
        eq(accessGrants.memberId, memberId),
        eq(accessGrants.organizationId, orgId),
      ),
      columns: { grantType: true, workspaceId: true, projectId: true },
    });

    if (grants.some((g) => g.grantType === 'org')) return null;
    if (grants.some((g) => g.grantType === 'workspace' && g.workspaceId === workspaceId)) {
      return null;
    }

    const projectIds = grants
      .filter((g) => g.grantType === 'project' && g.projectId)
      .map((g) => g.projectId as string);

    return projectIds;
  }
}
