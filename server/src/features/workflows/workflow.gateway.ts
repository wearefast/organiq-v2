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
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

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

      if (!this.jwks) {
        const clerkDomain = this.configService.get<string>('CLERK_DOMAIN') || 'clerk.dev';
        this.jwks = createRemoteJWKSet(new URL(`https://${clerkDomain}/.well-known/jwks.json`));
      }

      const { payload } = await jwtVerify(token, this.jwks);
      const clerkOrgId = payload.org_id as string | undefined;

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

  emitStepStarted(workflowRunId: string, stepKey: string) {
    this.server.to(`run:${workflowRunId}`).emit('step:started', { stepKey });
  }

  emitStepToolCall(workflowRunId: string, stepKey: string, toolName: string) {
    this.server.to(`run:${workflowRunId}`).emit('step:tool-call', { stepKey, toolName });
  }

  emitStepCompleted(workflowRunId: string, stepKey: string, status: string) {
    this.server.to(`run:${workflowRunId}`).emit('step:completed', { stepKey, status });
  }

  emitStepApproved(workflowRunId: string, stepKey: string) {
    this.server.to(`run:${workflowRunId}`).emit('step:approved', { stepKey });
  }

  emitStepRejected(workflowRunId: string, stepKey: string) {
    this.server.to(`run:${workflowRunId}`).emit('step:rejected', { stepKey });
  }

  emitStepError(workflowRunId: string, stepKey: string, error: string) {
    this.server.to(`run:${workflowRunId}`).emit('step:error', { stepKey, error });
  }

  emitWorkflowCompleted(workflowRunId: string) {
    this.server.to(`run:${workflowRunId}`).emit('workflow:completed', { workflowRunId });
  }
}
