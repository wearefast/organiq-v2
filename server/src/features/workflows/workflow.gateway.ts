import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { WorkflowService } from './workflow.service';

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allowed?: boolean) => void) => {
      const allowed = process.env.FRONTEND_URL || 'http://localhost:3001';
      if (!origin || origin === allowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  },
  namespace: '/workflows',
})
export class WorkflowGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WorkflowGateway.name);
  private readonly jwksByIssuer = new Map<string, { jwks: ReturnType<typeof createRemoteJWKSet>; createdAt: number }>();
  private static readonly JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly workflowService: WorkflowService,
  ) {}

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no auth token`);
        client.disconnect();
        return;
      }

      const issuer = this.resolveIssuer(token);
      const jwks = this.getJwks(issuer);

      const { payload } = await jwtVerify(token, jwks, {
        issuer,
      });
      // Clerk v2 JWTs store org at payload.o.id; v1 used payload.org_id
      const clerkOrgId = payload.org_id as string | undefined
        ?? (payload.o as { id?: string } | undefined)?.id;

      if (!clerkOrgId) {
        this.logger.warn(`Client ${client.id} rejected: no org context`);
        client.disconnect();
        return;
      }

      const org = await this.authService.findOrgByClerkId(clerkOrgId);
      if (!org) {
        this.logger.warn(`Client ${client.id} rejected: org not found`);
        client.disconnect();
        return;
      }

      // Attach org info to socket for subscription checks
      client.data.orgId = org.id;
      client.data.clerkUserId = payload.sub;
      this.logger.debug(`Client connected: ${client.id} (org: ${org.id})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(client: Socket, data: { workflowRunId: string }) {
    if (!client.data.orgId) {
      return;
    }

    // Verify the workflow belongs to the user's org
    try {
      const run = await this.workflowService.getRun(data.workflowRunId);
      if (run.organizationId !== client.data.orgId) {
        this.logger.warn(`Client ${client.id} denied subscription to run ${data.workflowRunId}`);
        return;
      }
    } catch {
      return;
    }

    const room = `run:${data.workflowRunId}`;
    client.join(room);
    this.logger.debug(`Client ${client.id} joined room ${room}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, data: { workflowRunId: string }) {
    const room = `run:${data.workflowRunId}`;
    client.leave(room);
    this.logger.debug(`Client ${client.id} left room ${room}`);
  }

  // ─── Emit Methods (called by processor/service) ────────────
  // All wrapped in try-catch to prevent Socket.IO failures from crashing the processor.

  emitStepStarted(workflowRunId: string, stepKey: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:started', { stepKey }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:started): ${e}`); }
  }

  emitStepToolCall(workflowRunId: string, stepKey: string, toolName: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:tool-call', { stepKey, toolName }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:tool-call): ${e}`); }
  }

  emitStepCompleted(workflowRunId: string, stepKey: string, status: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:completed', { stepKey, status }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:completed): ${e}`); }
  }

  emitStepApproved(workflowRunId: string, stepKey: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:approved', { stepKey }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:approved): ${e}`); }
  }

  emitStepRejected(workflowRunId: string, stepKey: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:rejected', { stepKey }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:rejected): ${e}`); }
  }

  emitStepRerun(workflowRunId: string, stepKey: string, cascadeReset: string[]) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:rerun', { stepKey, cascadeReset }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:rerun): ${e}`); }
  }

  emitStepError(workflowRunId: string, stepKey: string, error: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('step:error', { stepKey, error }); }
    catch (e) { this.logger.error(`WebSocket emit failed (step:error): ${e}`); }
  }

  emitWorkflowCompleted(workflowRunId: string) {
    try { this.server.to(`run:${workflowRunId}`).emit('workflow:completed', { workflowRunId }); }
    catch (e) { this.logger.error(`WebSocket emit failed (workflow:completed): ${e}`); }
  }

  // ─── Auth Helpers ──────────────────────────────────────────

  private getJwks(issuer: string) {
    const cached = this.jwksByIssuer.get(issuer);
    if (cached && Date.now() - cached.createdAt <= WorkflowGateway.JWKS_TTL_MS) {
      return cached.jwks;
    }

    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    this.jwksByIssuer.set(issuer, { jwks, createdAt: Date.now() });
    return jwks;
  }

  private resolveIssuer(token: string): string {
    const configuredDomain = this.configService.get<string>('CLERK_DOMAIN')?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (configuredDomain) {
      return `https://${configuredDomain}`;
    }

    // Fallback: read issuer from token (same logic as ClerkGuard)
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) throw new Error('Invalid token');

    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as { iss?: unknown };
    if (typeof payload.iss !== 'string') throw new Error('Invalid token');

    const issuer = new URL(payload.iss);
    const isTrustedDevIssuer =
      process.env.NODE_ENV !== 'production' &&
      issuer.protocol === 'https:' &&
      issuer.hostname.endsWith('.clerk.accounts.dev');

    if (!isTrustedDevIssuer) throw new Error('Untrusted issuer');
    return issuer.origin;
  }
}
