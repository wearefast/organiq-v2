import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Guard that resolves the Clerk org ID from the JWT into an internal org record.
 * Must be applied AFTER ClerkGuard.
 *
 * Attaches `req.org = { id, clerkOrgId }` to the request.
 * If the route/body contains an `organizationId`, validates it matches.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clerkOrgId = request.user?.clerkOrgId;

    if (!clerkOrgId) {
      throw new ForbiddenException('No organization context in session');
    }

    const org = await this.authService.findOrgByClerkId(clerkOrgId);
    if (!org) {
      throw new ForbiddenException('Organization not found');
    }

    // Attach internal org to request
    request.org = { id: org.id, clerkOrgId: org.clerkOrgId };

    // If the request specifies an organizationId (param or body), validate it matches
    const paramOrgId =
      request.params?.organizationId ?? request.params?.orgId;
    const bodyOrgId = request.body?.organizationId;
    const targetOrgId = paramOrgId || bodyOrgId;

    if (targetOrgId && targetOrgId !== org.id) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    return true;
  }
}
