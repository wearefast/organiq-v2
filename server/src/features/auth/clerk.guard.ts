import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

@Injectable()
export class ClerkGuard implements CanActivate {
  private readonly logger = new Logger(ClerkGuard.name);
  private readonly jwksByIssuer = new Map<string, { jwks: ReturnType<typeof createRemoteJWKSet>; createdAt: number }>();
  private static readonly JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const issuer = this.resolveIssuer(token);
      const jwks = this.getJwks(issuer);

      const { payload } = await jwtVerify(token, jwks, {
        issuer,
      });

      // Attach user info to request
      // Clerk v2 JWTs store org at payload.o.id; v1 used payload.org_id
      const orgClaim = payload.org_id ?? (payload.o as { id?: string } | undefined)?.id;
      request.user = {
        clerkUserId: payload.sub,
        clerkOrgId: orgClaim as string | undefined,
        sessionId: payload.sid as string | undefined,
      };

      return true;
    } catch (err) {
      this.logger.warn(`Token verification failed: ${err instanceof Error ? err.message : String(err)}`);
      // Log JWT header & issuer for diagnosis
      try {
        const [headerSeg, payloadSeg] = token.split('.');
        const header = JSON.parse(Buffer.from(headerSeg, 'base64url').toString());
        const payload = JSON.parse(Buffer.from(payloadSeg, 'base64url').toString());
        this.logger.warn(`JWT kid=${header.kid}, iss=${payload.iss}, resolved issuer=${this.resolveIssuer(token)}`);
      } catch { /* ignore parse errors */ }
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getJwks(issuer: string) {
    const cached = this.jwksByIssuer.get(issuer);
    if (cached && Date.now() - cached.createdAt <= ClerkGuard.JWKS_TTL_MS) {
      return cached.jwks;
    }

    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    this.jwksByIssuer.set(issuer, {
      jwks,
      createdAt: Date.now(),
    });
    return jwks;
  }

  private resolveIssuer(token: string): string {
    // Always read the actual issuer from the JWT payload
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) {
      throw new UnauthorizedException('Invalid token');
    }

    let payload: { iss?: unknown };
    try {
      payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as { iss?: unknown };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (typeof payload.iss !== 'string') {
      throw new UnauthorizedException('Invalid token');
    }

    let issuerUrl: URL;
    try {
      issuerUrl = new URL(payload.iss);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (issuerUrl.protocol !== 'https:') {
      throw new UnauthorizedException('Invalid token issuer');
    }

    // Validate it's a trusted Clerk issuer
    const configuredDomain = this.normalizeDomain(this.config.get<string>('CLERK_DOMAIN'));
    const hostname = issuerUrl.hostname;

    const isTrusted =
      // Matches explicitly configured CLERK_DOMAIN
      (configuredDomain && hostname === configuredDomain) ||
      // Standard Clerk dev instance domains
      hostname.endsWith('.clerk.accounts.dev') ||
      // Standard Clerk production domains
      hostname.endsWith('.clerk.dev');

    if (isTrusted) {
      return issuerUrl.origin;
    }

    // In non-production, also trust Clerk proxy domains (clerk.<customer-domain>)
    if (process.env.NODE_ENV !== 'production' && hostname.startsWith('clerk.')) {
      return issuerUrl.origin;
    }

    this.logger.warn(`Untrusted JWT issuer: ${payload.iss}`);
    throw new UnauthorizedException('Invalid token');
  }

  private normalizeDomain(value?: string | null): string | null {
    const trimmedValue = value?.trim();
    if (!trimmedValue) {
      return null;
    }
    return trimmedValue.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
}
