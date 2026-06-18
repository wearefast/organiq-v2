import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessService } from './access.service';
import { RESOURCE_ACCESS_KEY, ResourceAccessType } from './decorators/resource-access.decorator';

/**
 * Granular resource-level access guard.
 *
 * MUST run after OrgMembershipGuard (which attaches req.org and req.member).
 *
 * Logic:
 *   - Admin (role = 'admin' | 'owner') → always allowed
 *   - User (role = 'user' | 'member')  → checked against access_grants:
 *       Resource type is read from @ResourceAccess() decorator on the handler/controller.
 *       'workspace' → checks :workspaceId or :id param
 *       'project'   → checks :projectId or :id param (resolves parent workspaceId)
 *       'org' | none → checks if member has any grant in the org
 *
 * Usage:
 *   @UseGuards(ClerkGuard, OrgMembershipGuard, AccessGuard)
 *   @ResourceAccess('project')
 *   @Get(':id')
 *   async findOne(...)
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const role: string | undefined = request.member?.role;

    // Admins and legacy owners bypass granular checks
    if (role === 'admin' || role === 'owner') {
      return true;
    }

    const memberId: string | undefined = request.member?.id;
    const orgId: string | undefined = request.org?.id;

    if (!memberId || !orgId) {
      throw new ForbiddenException('No member context — ensure OrgMembershipGuard runs first');
    }

    const resourceType: ResourceAccessType | undefined = this.reflector.getAllAndOverride(
      RESOURCE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const params = request.params ?? {};

    if (resourceType === 'workspace') {
      const workspaceId: string | undefined = params.workspaceId ?? params.wId;
      if (!workspaceId) {
        // No unambiguous workspace ID in route — fall back to org-level grant check
        return this.denyIfNoGrant(memberId, orgId);
      }
      const allowed = await this.accessService.hasAccess(memberId, orgId, workspaceId, null);
      if (!allowed) throw new ForbiddenException('You do not have access to this workspace');
      return true;
    }

    if (resourceType === 'project') {
      const projectId: string | undefined = params.projectId ?? params.pId;
      if (!projectId) {
        return this.denyIfNoGrant(memberId, orgId);
      }

      // Resolve the project's workspaceId so workspace grants can cover this project
      const workspaceId = await this.accessService.resolveProjectWorkspace(projectId, orgId);

      const allowed = await this.accessService.hasAccess(memberId, orgId, workspaceId, projectId);
      if (!allowed) throw new ForbiddenException('You do not have access to this project');
      return true;
    }

    // Default: 'org' or no decorator — check that member has any grant
    return this.denyIfNoGrant(memberId, orgId);
  }

  private async denyIfNoGrant(memberId: string, orgId: string): Promise<boolean> {
    const hasAny = await this.accessService.hasAnyGrant(memberId, orgId);
    if (!hasAny) throw new ForbiddenException('You do not have access to this organization');
    return true;
  }
}
