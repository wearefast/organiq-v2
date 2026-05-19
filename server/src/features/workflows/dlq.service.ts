import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../../shared/database/database.service';
import { dlqFailedSteps } from '../../db/schema';
import { eq, isNull } from 'drizzle-orm';

@Injectable()
export class DlqService {
  constructor(
    private readonly db: DatabaseService,
    @InjectPinoLogger(DlqService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Capture a permanently failed job into the DLQ.
   * Called when a BullMQ job exhausts all retry attempts.
   */
  async captureFailedJob(params: {
    workflowStepId?: string;
    workflowRunId?: string;
    stepKey: string;
    error: string;
    attemptCount: number;
    jobData: Record<string, unknown>;
  }) {
    this.logger.error(
      { stepKey: params.stepKey, attemptCount: params.attemptCount },
      'Capturing failed job in DLQ',
    );

    const [entry] = await this.db.db
      .insert(dlqFailedSteps)
      .values({
        workflowStepId: params.workflowStepId ?? null,
        workflowRunId: params.workflowRunId ?? null,
        stepKey: params.stepKey,
        error: params.error,
        attemptCount: params.attemptCount,
        jobData: params.jobData,
      })
      .returning();

    return entry;
  }

  /** List all unresolved DLQ entries */
  async listUnresolved() {
    return this.db.db
      .select()
      .from(dlqFailedSteps)
      .where(isNull(dlqFailedSteps.resolvedAt))
      .orderBy(dlqFailedSteps.failedAt);
  }

  /** Mark a DLQ entry as resolved (after replay or dismiss) */
  async resolve(id: string) {
    const [updated] = await this.db.db
      .update(dlqFailedSteps)
      .set({ resolvedAt: new Date() })
      .where(eq(dlqFailedSteps.id, id))
      .returning();

    return updated;
  }

  /** Get a single DLQ entry by ID */
  async getById(id: string) {
    const [entry] = await this.db.db
      .select()
      .from(dlqFailedSteps)
      .where(eq(dlqFailedSteps.id, id));

    return entry ?? null;
  }
}
