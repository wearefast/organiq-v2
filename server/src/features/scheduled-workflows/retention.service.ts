import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { lt, and, isNotNull, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { llmTrafficSessions, agentRuns, workflowContext, stepArtifacts, workflowRuns } from '../../db/schema';

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

    // Purge workflow_context rows for runs older than 90 days.
    // Context JSONB values can reach 100 KB+ per step; keeping them indefinitely
    // bloats the table and slows context lookups for active runs.
    const oldRunIds = await this.db.db
      .select({ id: workflowRuns.id })
      .from(workflowRuns)
      .where(lt(workflowRuns.createdAt, traffic90d));

    let contextDeleted = 0;
    let artifactDeleted = 0;

    if (oldRunIds.length > 0) {
      const ids = oldRunIds.map((r) => r.id);

      const contextResult = await this.db.db
        .delete(workflowContext)
        .where(inArray(workflowContext.workflowRunId, ids));
      contextDeleted = (contextResult as any).rowCount ?? 0;

      // Purge step_artifacts for the same old runs.
      // step_artifacts.data can contain large JSON blobs (article body, keyword arrays).
      // The content_images base64 should already have been stripped at approval time,
      // but purging removes any residual data accumulated before that fix was deployed.
      const artifactResult = await this.db.db
        .delete(stepArtifacts)
        .where(inArray(stepArtifacts.workflowRunId, ids));
      artifactDeleted = (artifactResult as any).rowCount ?? 0;
    }

    this.logger.log(
      `Retention purge complete — traffic sessions (>90d): ${(trafficResult as any).rowCount ?? 0} removed, ` +
        `agent run responses (>30d): ${(thinkingResult as any).rowCount ?? 0} cleared, ` +
        `workflow context rows (>90d): ${contextDeleted} removed, ` +
        `step artifacts (>90d): ${artifactDeleted} removed`,
    );
  }
}
