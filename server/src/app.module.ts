import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from './shared/database/database.module';
import { HealthModule } from './shared/health/health.module';
import { AuditModule } from './features/audit/audit.module';
import { LeadsModule } from './features/leads/leads.module';
import { KeywordsModule } from './features/keywords/keywords.module';
import { ContentModule } from './features/content/content.module';
import { IntegrationsModule } from './features/integrations/integrations.module';
import { WebhooksModule } from './features/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../.env' }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
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
