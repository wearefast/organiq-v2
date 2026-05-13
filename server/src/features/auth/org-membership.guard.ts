import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AuthService } from './auth.service';
import { DatabaseService } from '../../shared/database/database.service';
import { organizations, orgMembers, projects, workflowRuns } from '../../db/schema';

/**
 * Guard that resolves the Clerk org ID from the JWT into an internal org record.
 * Must be applied AFTER ClerkGuard.
 *
 * Attaches `req.org = { id, clerkOrgId }` to the request.
 * Validates:
 *   1. If route/body contains `organizationId`, it matches the user's org.
 *   2. If route contains `projectId`, the project belongs to the user's org.
 *   3. If route is under /workflows/ and contains `:id`, the run belongs to the user's org.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clerkOrgId = request.user?.clerkOrgId;
    const clerkUserId = request.user?.clerkUserId;

    const requestedOrgId =
      request.params?.organizationId ?? request.params?.orgId ?? request.body?.organizationId;

    let org = clerkOrgId ? await this.authService.findOrgByClerkId(clerkOrgId) : null;

    if (!org && requestedOrgId) {
      org = requestedOrgId.startsWith('org_')
        ? await this.authService.findOrgByClerkId(requestedOrgId)
        : await this.db.db.query.organizations.findFirst({
            where: eq(organizations.id, requestedOrgId),
          });
    }

    // Fallback: resolve org from projectId (param or body)
    if (!org) {
      const projectIdHint = request.params?.projectId ?? request.body?.projectId;
      if (projectIdHint) {
        const project = await this.db.db.query.projects.findFirst({
          where: eq(projects.id, projectIdHint),
          columns: { organizationId: true },
        });
        if (project) {
          org = await this.db.db.query.organizations.findFirst({
            where: eq(organizations.id, project.organizationId),
          });
        }
      }
    }

    // Fallback: resolve org from workflow run ID (for /workflows/:id routes)
    if (!org) {
      const requestUrl: string = request.originalUrl ?? request.url ?? '';
      const runId = request.params?.id;
      if (runId && requestUrl.startsWith('/workflows')) {
        const run = await this.db.db.query.workflowRuns.findFirst({
          where: eq(workflowRuns.id, runId),
          columns: { organizationId: true },
        });
        if (run) {
          org = await this.db.db.query.organizations.findFirst({
            where: eq(organizations.id, run.organizationId),
          });
        }
      }
    }

    if (!org) {
      throw new ForbiddenException('No organization context in session');
    }

    if (!clerkUserId) {
      throw new ForbiddenException('No user context in session');
    }

    const membership = await this.db.db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.organizationId, org.id), eq(orgMembers.clerkUserId, clerkUserId)),
      columns: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    // Attach internal org to request
    request.org = { id: org.id, clerkOrgId: org.clerkOrgId };

    if (request.params?.organizationId === org.clerkOrgId) {
      request.params.organizationId = org.id;
    }
    if (request.params?.orgId === org.clerkOrgId) {
      request.params.orgId = org.id;
    }
    if (request.body?.organizationId === org.clerkOrgId) {
      request.body.organizationId = org.id;
    }

    // If the request specifies an organizationId (param or body), validate it matches
    const paramOrgId =
      request.params?.organizationId ?? request.params?.orgId;
    const bodyOrgId = request.body?.organizationId;
    const targetOrgId = paramOrgId || bodyOrgId;

    if (targetOrgId && targetOrgId !== org.id) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    // Validate project ownership: if :projectId is in the route, it must belong to this org
    const projectId = request.params?.projectId;
    if (projectId) {
      const project = await this.db.db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { organizationId: true },
      });
      if (!project) {
        throw new ForbiddenException('Project not found');
      }
      if (project.organizationId !== org.id) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    // Validate workflow run ownership: if URL starts with /workflows/ and :id param exists
    const requestUrl2: string = request.originalUrl ?? request.url ?? '';
    const runId = request.params?.id;
    if (runId && requestUrl2.startsWith('/workflows')) {
      const run = await this.db.db.query.workflowRuns.findFirst({
        where: eq(workflowRuns.id, runId),
        columns: { organizationId: true },
      });
      if (!run) {
        throw new ForbiddenException('Workflow run not found');
      }
      if (run.organizationId !== org.id) {
        throw new ForbiddenException('You do not have access to this workflow run');
      }
    }

    return true;
  }
}
