import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class ClerkGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.slice(7);

    try {
      if (!this.jwks) {
        const clerkDomain = this.config.get<string>('CLERK_DOMAIN') || 'clerk.dev';
        this.jwks = createRemoteJWKSet(new URL(`https://${clerkDomain}/.well-known/jwks.json`));
      }

      const { payload } = await jwtVerify(token, this.jwks);

      // Attach user info to request
      request.user = {
        clerkUserId: payload.sub,
        clerkOrgId: payload.org_id as string | undefined,
        sessionId: payload.sid as string | undefined,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
