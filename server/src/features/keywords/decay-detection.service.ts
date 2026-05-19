import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, gte, lte, sql, avg, sum, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { gscKeywordData, keywordDecayAlerts, notifications, projects } from '../../db/schema';

interface DecayCandidate {
  keyword: string;
  page: string;
  previousPosition: number;
  currentPosition: number;
  positionDelta: number;
  previousClicks: number;
  currentClicks: number;
}

type DecaySeverity = 'low' | 'medium' | 'high' | 'critical';

@Injectable()
export class DecayDetectionService {
  private readonly logger = new Logger(DecayDetectionService.name);

  // Thresholds: position drop that triggers each severity level
  private static readonly THRESHOLDS: Record<DecaySeverity, number> = {
    low: 3,       // dropped 3+ positions
    medium: 5,    // dropped 5+ positions
    high: 10,     // dropped 10+ positions
    critical: 20, // dropped 20+ positions
  };

  constructor(
    private readonly db: DatabaseService,
    @InjectQueue('decay-detection') private readonly decayQueue: Queue,
  ) {}

  /**
   * Detect keyword position decay for a project by comparing two time windows.
   * Recent window: last 7 days. Previous window: 7 days before that.
   */
  async detectDecay(projectId: string): Promise<number> {
    const now = new Date();
    const recentEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // yesterday
    const recentStart = new Date(recentEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(recentStart.getTime() - 1 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(previousEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get project to find organizationId
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) return 0;

    // Recent period aggregation (avg position, sum clicks per keyword+page)
    const recentData = await this.db.db
      .select({
        keyword: gscKeywordData.query,
        page: gscKeywordData.page,
        avgPosition: avg(gscKeywordData.position).mapWith(Number),
        totalClicks: sum(gscKeywordData.clicks).mapWith(Number),
      })
      .from(gscKeywordData)
      .where(
        and(
          eq(gscKeywordData.projectId, projectId),
          gte(gscKeywordData.date, recentStart),
          lte(gscKeywordData.date, recentEnd),
        ),
      )
      .groupBy(gscKeywordData.query, gscKeywordData.page);

    if (recentData.length === 0) return 0;

    // Previous period aggregation
    const previousData = await this.db.db
      .select({
        keyword: gscKeywordData.query,
        page: gscKeywordData.page,
        avgPosition: avg(gscKeywordData.position).mapWith(Number),
        totalClicks: sum(gscKeywordData.clicks).mapWith(Number),
      })
      .from(gscKeywordData)
      .where(
        and(
          eq(gscKeywordData.projectId, projectId),
          gte(gscKeywordData.date, previousStart),
          lte(gscKeywordData.date, previousEnd),
        ),
      )
      .groupBy(gscKeywordData.query, gscKeywordData.page);

    // Build lookup of previous positions
    const previousMap = new Map<string, { position: number; clicks: number }>();
    for (const row of previousData) {
      previousMap.set(`${row.keyword}::${row.page}`, {
        position: row.avgPosition ?? 0,
        clicks: row.totalClicks ?? 0,
      });
    }

    // Find decay candidates
    const candidates: DecayCandidate[] = [];
    for (const current of recentData) {
      const key = `${current.keyword}::${current.page}`;
      const prev = previousMap.get(key);
      if (!prev) continue; // New keyword, skip

      const delta = (current.avgPosition ?? 0) - prev.position;
      if (delta >= DecayDetectionService.THRESHOLDS.low) {
        candidates.push({
          keyword: current.keyword,
          page: current.page,
          previousPosition: prev.position,
          currentPosition: current.avgPosition ?? 0,
          positionDelta: delta,
          previousClicks: prev.clicks,
          currentClicks: current.totalClicks ?? 0,
        });
      }
    }

    if (candidates.length === 0) return 0;

    // Determine severity and insert alerts + notifications
    let alertCount = 0;
    for (const candidate of candidates) {
      const severity = this.classifySeverity(candidate.positionDelta);

      // Insert decay alert
      const [alert] = await this.db.db
        .insert(keywordDecayAlerts)
        .values({
          projectId,
          organizationId: project.organizationId,
          keyword: candidate.keyword,
          page: candidate.page,
          previousPosition: String(candidate.previousPosition),
          currentPosition: String(candidate.currentPosition),
          positionDelta: String(candidate.positionDelta),
          previousClicks: candidate.previousClicks,
          currentClicks: candidate.currentClicks,
          severity,
          snapshotStartDate: previousStart,
          snapshotEndDate: recentEnd,
        })
        .returning({ id: keywordDecayAlerts.id });

      // Create notification for the org
      await this.db.db.insert(notifications).values({
        organizationId: project.organizationId,
        projectId,
        type: 'decay_alert',
        title: `Position decay: "${candidate.keyword}"`,
        message: `Dropped ${candidate.positionDelta.toFixed(1)} positions (${candidate.previousPosition.toFixed(1)} → ${candidate.currentPosition.toFixed(1)})`,
        metadata: { alertId: alert.id, severity, page: candidate.page },
      });

      alertCount++;
    }

    this.logger.log(`Decay detection for project ${projectId}: ${alertCount} alerts created`);
    return alertCount;
  }

  private classifySeverity(delta: number): DecaySeverity {
    if (delta >= DecayDetectionService.THRESHOLDS.critical) return 'critical';
    if (delta >= DecayDetectionService.THRESHOLDS.high) return 'high';
    if (delta >= DecayDetectionService.THRESHOLDS.medium) return 'medium';
    return 'low';
  }

  /** Get decay alerts for a project (unresolved only by default) */
  async getAlerts(projectId: string, opts: { includeResolved?: boolean; limit?: number } = {}) {
    const conditions = [eq(keywordDecayAlerts.projectId, projectId)];
    if (!opts.includeResolved) {
      conditions.push(sql`${keywordDecayAlerts.resolvedAt} IS NULL`);
    }

    return this.db.db.query.keywordDecayAlerts.findMany({
      where: and(...conditions),
      orderBy: [desc(keywordDecayAlerts.detectedAt)],
      limit: Math.min(opts.limit ?? 50, 200),
    });
  }

  /** Mark an alert as resolved */
  async resolveAlert(alertId: string): Promise<void> {
    await this.db.db
      .update(keywordDecayAlerts)
      .set({ resolvedAt: new Date() })
      .where(eq(keywordDecayAlerts.id, alertId));
  }

  /** Run decay detection for all projects that have GSC connected */
  async runForAllProjects(): Promise<number> {
    const connectedProjects = await this.db.db
      .select({ projectId: sql<string>`DISTINCT ${gscKeywordData.projectId}` })
      .from(gscKeywordData);

    let total = 0;
    for (const { projectId } of connectedProjects) {
      try {
        total += await this.detectDecay(projectId);
      } catch (error) {
        this.logger.error(`Decay detection failed for project ${projectId}: ${(error as Error).message}`);
      }
    }
    return total;
  }
}
