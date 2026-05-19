import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lt, and, isNotNull } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { llmTrafficSessions, agentRuns } from '../../db/schema';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private readonly db: DatabaseService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async purgeOldData() {
    this.logger.log('Starting weekly data retention purge...');

    const now = new Date();

    // Purge LLM traffic sessions older than 90 days
    const traffic90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const trafficResult = await this.db.db
      .delete(llmTrafficSessions)
      .where(lt(llmTrafficSessions.createdAt, traffic90d));

    // Null out agent run response/recommendations older than 30 days
    // (preserves the audit record for credit debit history)
    const thinking30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thinkingResult = await this.db.db
      .update(agentRuns)
      .set({ response: null, recommendations: null })
      .where(
        and(
          lt(agentRuns.createdAt, thinking30d),
          isNotNull(agentRuns.response),
        ),
      );

    this.logger.log(
      `Retention purge complete — traffic sessions (>90d): ${(trafficResult as any).rowCount ?? 0} removed, agent run responses (>30d): ${(thinkingResult as any).rowCount ?? 0} cleared`,
    );
  }
}
