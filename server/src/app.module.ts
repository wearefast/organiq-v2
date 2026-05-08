import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { resolve } from 'path';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './shared/health/health.module';
import { AuditModule } from './features/audit/audit.module';
import { LeadsModule } from './features/leads/leads.module';
import { KeywordsModule } from './features/keywords/keywords.module';
import { ContentModule } from './features/content/content.module';
import { IntegrationsModule } from './features/integrations/integrations.module';
import { WebhooksModule } from './features/webhooks/webhooks.module';

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
    ConfigModule.forRoot({ isGlobal: true, envFilePath: resolveEnvFilePaths() }),
    BullModule.forRoot({
      connection: {
        host: resolveBullRedisHost(),
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    DatabaseModule,
    HealthModule,
    AuditModule,
    LeadsModule,
    KeywordsModule,
    ContentModule,
    IntegrationsModule,
    WebhooksModule,
  ],
})
export class AppModule {}
