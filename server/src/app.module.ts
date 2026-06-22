import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './shared/health/health.module';
import { PromptModule } from './shared/prompt/prompt.module';
import { VerificationModule } from './shared/verification/verification.module';
import { WebCrawlerModule } from './shared/web-crawler/web-crawler.module';
import { AuthModule } from './features/auth/auth.module';
import { OrganizationsModule } from './features/organizations/organizations.module';
import { CreditsModule } from './features/credits/credits.module';
import { WorkspacesModule } from './features/workspaces/workspaces.module';
import { ProjectsModule } from './features/projects/projects.module';
import { IntegrationsModule } from './features/integrations/integrations.module';
import { AgentsModule } from './agents/agents.module';
import { WorkflowsModule } from './features/workflows/workflows.module';
import { KeywordsModule } from './features/keywords/keywords.module';
import { TopicalMapsModule } from './features/topical-maps/topical-maps.module';
import { ContentModule } from './features/content/content.module';
import { ReportsModule } from './features/reports/reports.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { LlmTrafficModule } from './features/llm-traffic/llm-traffic.module';
import { LlmAuditModule } from './features/audit/llm-audit.module';
import { PromptVisibilityModule } from './features/prompt-visibility/prompt-visibility.module';
import { OnDemandAgentsModule } from './features/on-demand-agents/on-demand-agents.module';
import { ScheduledWorkflowsModule } from './features/scheduled-workflows/scheduled-workflows.module';
import { BillingModule } from './features/billing/billing.module';
import { UserManagementModule } from './features/user-management/user-management.module';
import { InternalModule } from './features/internal/internal.module';
import { ApiUsageModule } from './features/api-usage/api-usage.module';
import { validateEnv } from './shared/config/env.validation';

function resolveBullRedisHost() {
  const configuredHost = process.env.REDIS_HOST?.trim();

  if (configuredHost) {
    if (process.platform === 'win32' && configuredHost.toLowerCase() === 'localhost') {
      return '127.0.0.1';
    }

    return configuredHost;
  }

  return process.platform === 'win32' ? '127.0.0.1' : 'localhost';
}

function resolveEnvFilePaths() {
  return [resolve(__dirname, '..', '..', '.env'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')];
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolveEnvFilePaths(), validate: validateEnv }),
    // Global rate limiting: 120 requests per 60 seconds per IP.
    // Individual controllers can override with @Throttle({ default: { limit, ttl } }).
    // Use @SkipThrottle() on read-only health/status routes if needed.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => req.headers['x-correlation-id'] || randomUUID(),
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: { ignore: (req) => (req as any).url === '/health' },
      },
    }),
    BullModule.forRoot({
      connection: {
        host: resolveBullRedisHost(),
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    }),
    DatabaseModule,
    HealthModule,
    PromptModule,
    VerificationModule,
    WebCrawlerModule,
    AuthModule,
    OrganizationsModule,
    CreditsModule,
    WorkspacesModule,
    ProjectsModule,
    IntegrationsModule,
    AgentsModule,
    WorkflowsModule,
    KeywordsModule,
    TopicalMapsModule,
    ContentModule,
    ReportsModule,
    NotificationsModule,
    LlmTrafficModule,
    LlmAuditModule,
    PromptVisibilityModule,
    OnDemandAgentsModule,
    ScheduledWorkflowsModule,
    BillingModule,
    UserManagementModule,
    InternalModule,
    ApiUsageModule,
  ],
  providers: [
    // Enforce global rate limiting across all controllers.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
