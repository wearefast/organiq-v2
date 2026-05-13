import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { resolve } from 'path';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './shared/health/health.module';
import { PromptModule } from './shared/prompt/prompt.module';
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
    BullModule.forRoot({
      connection: {
        host: resolveBullRedisHost(),
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    DatabaseModule,
    HealthModule,
    PromptModule,
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
  ],
})
export class AppModule {}
