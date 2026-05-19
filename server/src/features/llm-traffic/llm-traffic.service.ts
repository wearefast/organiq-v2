import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, gte, lte, desc, sql, sum, count } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { llmTrafficSessions, llmTrafficStats, projects } from '../../db/schema';

// 12 AI engines we detect
export const LLM_ENGINES = [
  'chatgpt',
  'perplexity',
  'claude',
  'gemini',
  'copilot',
  'you',
  'phind',
  'kagi',
  'neeva',
  'brave-search',
  'meta-ai',
  'cohere',
] as const;

export type LlmEngine = (typeof LLM_ENGINES)[number];

export interface IngestPayload {
  projectId: string;
  engine: string;
  referrer?: string;
  landingPage: string;
  sessionId: string;
  country?: string;
  device?: string;
}

export interface TrafficOverview {
  totalSessions: number;
  byEngine: Array<{ engine: string; sessions: number }>;
  dailyTrend: Array<{ date: string; sessions: number }>;
  topPages: Array<{ page: string; sessions: number }>;
}

@Injectable()
export class LlmTrafficService {
  private readonly logger = new Logger(LlmTrafficService.name);

  // Simple in-memory rate limiter: projectId → { count, windowStart }
  private rateLimits = new Map<string, { count: number; windowStart: number }>();
  private static readonly RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
  private static readonly RATE_LIMIT_MAX = 100; // 100 events per minute per project
  private static readonly RATE_LIMIT_MAX_ENTRIES = 10_000; // Max tracked projects

  constructor(
    private readonly db: DatabaseService,
    @InjectQueue('llm-traffic') private readonly trafficQueue: Queue,
  ) {
    // Evict stale rate limit entries every 5 minutes
    setInterval(() => this.evictStaleRateLimits(), 5 * 60_000);
  }

  private evictStaleRateLimits() {
    const now = Date.now();
    for (const [key, entry] of this.rateLimits) {
      if (now - entry.windowStart > LlmTrafficService.RATE_LIMIT_WINDOW_MS * 2) {
        this.rateLimits.delete(key);
      }
    }
  }

  /** Check rate limit for a project. Returns true if allowed. */
  checkRateLimit(projectId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(projectId);

    if (!entry || now - entry.windowStart > LlmTrafficService.RATE_LIMIT_WINDOW_MS) {
      // Evict oldest if at capacity
      if (this.rateLimits.size >= LlmTrafficService.RATE_LIMIT_MAX_ENTRIES) {
        const firstKey = this.rateLimits.keys().next().value;
        if (firstKey) this.rateLimits.delete(firstKey);
      }
      this.rateLimits.set(projectId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= LlmTrafficService.RATE_LIMIT_MAX) {
      return false;
    }

    entry.count++;
    return true;
  }

  /** Validate and ingest a traffic event */
  async ingest(payload: IngestPayload): Promise<{ accepted: boolean; reason?: string }> {
    // Validate engine
    if (!LLM_ENGINES.includes(payload.engine as LlmEngine)) {
      return { accepted: false, reason: 'unknown_engine' };
    }

    // Validate projectId exists
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, payload.projectId),
      columns: { id: true },
    });
    if (!project) {
      return { accepted: false, reason: 'invalid_project' };
    }

    // Rate limit check
    if (!this.checkRateLimit(payload.projectId)) {
      return { accepted: false, reason: 'rate_limited' };
    }

    // Insert session (dedup on sessionId via unique index)
    try {
      await this.db.db
        .insert(llmTrafficSessions)
        .values({
          projectId: payload.projectId,
          engine: payload.engine,
          referrer: payload.referrer ?? null,
          landingPage: payload.landingPage,
          sessionId: payload.sessionId,
          country: payload.country ?? null,
          device: payload.device ?? null,
        })
        .onConflictDoNothing();
    } catch (error) {
      this.logger.error(`Ingest failed: ${(error as Error).message}`);
      return { accepted: false, reason: 'internal_error' };
    }

    return { accepted: true };
  }

  /** Get traffic overview for a project */
  async getOverview(projectId: string, startDate: string, endDate: string): Promise<TrafficOverview> {
    const dateFilter = and(
      eq(llmTrafficStats.projectId, projectId),
      gte(llmTrafficStats.date, new Date(startDate)),
      lte(llmTrafficStats.date, new Date(endDate)),
    );

    // Total sessions from stats table
    const [totals] = await this.db.db
      .select({ total: sum(llmTrafficStats.sessions).mapWith(Number) })
      .from(llmTrafficStats)
      .where(dateFilter);

    // Sessions by engine
    const byEngine = await this.db.db
      .select({
        engine: llmTrafficStats.engine,
        sessions: sum(llmTrafficStats.sessions).mapWith(Number),
      })
      .from(llmTrafficStats)
      .where(dateFilter)
      .groupBy(llmTrafficStats.engine)
      .orderBy(desc(sum(llmTrafficStats.sessions)));

    // Daily trend
    const dailyTrend = await this.db.db
      .select({
        date: llmTrafficStats.date,
        sessions: sum(llmTrafficStats.sessions).mapWith(Number),
      })
      .from(llmTrafficStats)
      .where(dateFilter)
      .groupBy(llmTrafficStats.date)
      .orderBy(llmTrafficStats.date);

    // Top landing pages from raw sessions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const topPages = await this.db.db
      .select({
        page: llmTrafficSessions.landingPage,
        sessions: count(),
      })
      .from(llmTrafficSessions)
      .where(
        and(
          eq(llmTrafficSessions.projectId, projectId),
          gte(llmTrafficSessions.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(llmTrafficSessions.landingPage)
      .orderBy(desc(count()))
      .limit(20);

    return {
      totalSessions: totals?.total ?? 0,
      byEngine: byEngine.map((r) => ({ engine: r.engine, sessions: r.sessions ?? 0 })),
      dailyTrend: dailyTrend.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        sessions: r.sessions ?? 0,
      })),
      topPages: topPages.map((r) => ({ page: r.page, sessions: r.sessions })),
    };
  }

  /** Aggregate raw sessions into daily stats. Called by cron. */
  async aggregateDaily(): Promise<number> {
    // Aggregate yesterday's sessions
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayStart = new Date(yesterday.toISOString().slice(0, 10));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const aggregated = await this.db.db
      .select({
        projectId: llmTrafficSessions.projectId,
        engine: llmTrafficSessions.engine,
        sessions: count(),
      })
      .from(llmTrafficSessions)
      .where(
        and(
          gte(llmTrafficSessions.createdAt, dayStart),
          lte(llmTrafficSessions.createdAt, dayEnd),
        ),
      )
      .groupBy(llmTrafficSessions.projectId, llmTrafficSessions.engine);

    if (aggregated.length === 0) return 0;

    // Upsert into stats
    for (const row of aggregated) {
      await this.db.db
        .insert(llmTrafficStats)
        .values({
          projectId: row.projectId,
          engine: row.engine,
          date: dayStart,
          sessions: row.sessions,
        })
        .onConflictDoUpdate({
          target: [llmTrafficStats.projectId, llmTrafficStats.engine, llmTrafficStats.date],
          set: { sessions: row.sessions },
        });
    }

    this.logger.log(`Aggregated ${aggregated.length} traffic stat rows for ${dayStart.toISOString().slice(0, 10)}`);
    return aggregated.length;
  }

  /** Purge sessions older than 90 days (AD-9) */
  async purgeExpiredSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.db.db
      .delete(llmTrafficSessions)
      .where(lte(llmTrafficSessions.createdAt, cutoff));

    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    this.logger.log(`Purged ${count} expired traffic sessions (older than 90d)`);
    return count;
  }
}
