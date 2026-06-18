import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that restricts access to Admin-role members only.
 *
 * MUST run after OrgMembershipGuard (which attaches req.member).
 *
 * Usage:
 *   @UseGuards(ClerkGuard, OrgMembershipGuard, AdminOnlyGuard)
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role: string | undefined = request.member?.role;

    // 'owner' is a legacy Clerk role treated as admin
    if (role === 'admin' || role === 'owner') {
      return true;
    }

    throw new ForbiddenException('This action requires admin access');
  }
}
