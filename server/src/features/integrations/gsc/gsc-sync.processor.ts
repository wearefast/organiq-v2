import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { GscService } from './gsc.service';

interface GscSyncJobData {
  projectId: string;
  connectionId: string;
  startDate: string;
  endDate: string;
  type: 'daily' | 'historical';
}

@Processor('gsc-sync')
export class GscSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(GscSyncProcessor.name);

  constructor(private readonly gscService: GscService) {
    super();
  }

  async process(job: Job<GscSyncJobData>): Promise<void> {
    const { projectId, connectionId, type } = job.data;
    // For daily jobs, default to yesterday if dates are empty
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startDate = job.data.startDate || yesterday;
    const endDate = job.data.endDate || yesterday;
    this.logger.log(`GSC sync (${type}): project=${projectId}, range=${startDate}→${endDate}`);

    try {
      // Pull data from Google Search Console
      const result = (await this.gscService.pullSearchAnalytics({
        projectId,
        startDate,
        endDate,
        dimensions: ['query', 'page', 'date'],
      })) as { rows?: Array<Record<string, unknown>> };

      const rows = result.rows ?? [];
      this.logger.log(`GSC sync: received ${rows.length} rows for project ${projectId}`);

      if (rows.length > 0) {
        const stored = await this.gscService.storeKeywordData(connectionId, projectId, rows);
        this.logger.log(`GSC sync complete: stored ${stored} rows for project ${projectId}`);
      }
    } catch (error) {
      this.logger.error(`GSC sync failed for project ${projectId}: ${(error as Error).message}`);
      throw error; // Let BullMQ retry
    }
  }
}
