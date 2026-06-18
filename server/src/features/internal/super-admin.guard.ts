import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that restricts access to internal platform admin operations.
 * Reads SUPER_ADMIN_CLERK_IDS from env (comma-separated Clerk user IDs).
 *
 * Must run after ClerkGuard (which attaches req.user.clerkUserId).
 *
 * This guard is for INTERNAL endpoints only — not customer-facing.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clerkUserId: string | undefined = request.user?.clerkUserId;

    if (!clerkUserId) {
      throw new ForbiddenException('Authentication required');
    }

    const allowedIds = this.config
      .get<string>('SUPER_ADMIN_CLERK_IDS', '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (allowedIds.length === 0) {
      throw new ForbiddenException('Super-admin access is not configured');
    }

    if (!allowedIds.includes(clerkUserId)) {
      throw new ForbiddenException('Super-admin access required');
    }

    return true;
  }
}
