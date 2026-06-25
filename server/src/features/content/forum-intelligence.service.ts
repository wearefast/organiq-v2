import { Injectable, Logger } from '@nestjs/common';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { DataForSeoService } from '../integrations/dataforseo/dataforseo.service';
import { ForumDateEnricherService } from './forum-date-enricher.service';
import {
  forumTopics,
  forumOpportunities,
  keywords,
  projects,
} from '../../db/schema';

interface SerpItem {
  type?: string;
  title?: string;
  url?: string;
  description?: string;
  rank_absolute?: number;
  timestamp?: string;
}

@Injectable()
export class ForumIntelligenceService {
  private readonly logger = new Logger(ForumIntelligenceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly dataForSeo: DataForSeoService,
    private readonly dateEnricher: ForumDateEnricherService,
  ) {}

  // ─── Topic Generation ────────────────────────────────────────

  /**
   * Auto-generate forum monitoring topics from the project's business profile
   * and keyword data. Uses ICP pain points, industry, and positioning to create
   * niche-specific search queries.
   */
  async generateTopics(projectId: string): Promise<number> {
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { industry: true, name: true, domain: true, businessProfile: true, country: true },
    });

    const bp = project?.businessProfile as {
      industry?: string;
      positioning?: string;
      icp?: { pain_points?: string[]; description?: string; industries?: string[] };
      content_gaps?: string[];
    } | null;

    const topics = new Set<string>();

    // 1. Derive niche qualifier from business profile
    const nicheQualifier = this.buildNicheQualifier(project, bp);

    // 2. Use ICP pain points as high-value topics (these are what users actually ask about)
    if (bp?.icp?.pain_points) {
      for (const pain of bp.icp.pain_points.slice(0, 4)) {
        // Shorten to key phrases, prepend niche qualifier
        const shortened = pain
          .replace(/^(Difficulty|Wasting time|Missing|Not knowing|Lack of)\s+/i, '')
          .toLowerCase()
          .slice(0, 60);
        topics.add(shortened);
      }
    }

    // 3. Use top parent topics from keywords but qualified with niche
    const parentTopics = await this.db.db
      .select({ parentTopic: keywords.parentTopic })
      .from(keywords)
      .where(and(eq(keywords.projectId, projectId), sql`${keywords.parentTopic} IS NOT NULL`))
      .groupBy(keywords.parentTopic)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    for (const row of parentTopics) {
      if (row.parentTopic) {
        const topic = row.parentTopic.toLowerCase().trim();
        // Only add if it's sufficiently specific (3+ words) or append niche
        if (topic.split(' ').length >= 3) {
          topics.add(topic);
        } else if (nicheQualifier) {
          topics.add(`${topic} ${nicheQualifier}`);
        }
      }
    }

    // 4. Add industry-specific conversational queries
    if (bp?.industry) {
      const ind = bp.industry.toLowerCase();
      topics.add(`best ${ind}`);
      topics.add(`${ind} recommendations`);
    } else if (project?.industry) {
      topics.add(`${project.industry.toLowerCase()} recommendations`);
    }

    // Upsert topics into forum_topics
    let inserted = 0;
    for (const topic of topics) {
      try {
        await this.db.db
          .insert(forumTopics)
          .values({ projectId, topic, source: 'auto' })
          .onConflictDoNothing({ target: [forumTopics.projectId, forumTopics.topic] });
        inserted++;
      } catch {
        // unique constraint — already exists
      }
    }

    this.logger.log(`Generated ${inserted} forum topics for project ${projectId}`);
    return inserted;
  }

  /**
   * Build a short niche qualifier from the project's data (e.g. "UAE deals", "SaaS pricing").
   * Used to scope generic topic terms into the project's niche.
   */
  private buildNicheQualifier(
    project: { country?: string | null; industry?: string | null; name?: string | null } | null | undefined,
    bp: { industry?: string; icp?: { description?: string } } | null | undefined,
  ): string {
    const parts: string[] = [];

    // Country context
    const country = project?.country?.toUpperCase();
    if (country && country !== 'US' && country !== 'GB') {
      // Non-English-majority markets benefit from explicit country qualifier
      const countryNames: Record<string, string> = { AE: 'UAE', SA: 'Saudi', IN: 'India', AU: 'Australia', CA: 'Canada', DE: 'Germany' };
      parts.push(countryNames[country] ?? country);
    }

    // Industry keyword (short)
    if (bp?.industry) {
      const short = bp.industry.split('/')[0].trim().toLowerCase();
      if (short.length <= 20) parts.push(short);
    } else if (project?.industry) {
      const short = project.industry.split(',')[0].trim().toLowerCase();
      if (short.length <= 20) parts.push(short);
    }

    return parts.join(' ');
  }

  // ─── Scanning ────────────────────────────────────────────────

  /**
   * Scan all active topics for a project and store new opportunities.
   */
  async scanProject(projectId: string): Promise<number> {
    const topics = await this.db.db.query.forumTopics.findMany({
      where: and(eq(forumTopics.projectId, projectId), eq(forumTopics.status, 'active')),
    });

    if (topics.length === 0) {
      // Auto-generate topics on first scan
      await this.generateTopics(projectId);
      return this.scanProject(projectId);
    }

    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { country: true, industry: true, businessProfile: true, domain: true },
    });

    // Build relevance context for filtering
    const bp = project?.businessProfile as {
      industry?: string;
      icp?: { description?: string; industries?: string[] };
      positioning?: string;
    } | null;

    const relevanceKeywords = this.buildRelevanceKeywords(project, bp);

    let totalNew = 0;

    for (const topic of topics) {
      try {
        const newCount = await this.scanTopic(topic.id, topic.topic, projectId, project?.country ?? 'us', relevanceKeywords);
        totalNew += newCount;

        // Update last scanned timestamp
        await this.db.db
          .update(forumTopics)
          .set({ lastScannedAt: new Date() })
          .where(eq(forumTopics.id, topic.id));
      } catch (error) {
        this.logger.warn(`Failed to scan topic "${topic.topic}": ${error instanceof Error ? error.message : error}`);
      }
    }

    this.logger.log(`Scan complete for project ${projectId}: ${totalNew} new opportunities`);

    // Fire-and-forget: enrich undated opportunities in the background
    void this.dateEnricher.enrichMissingDates(projectId);

    return totalNew;
  }

  /**
   * Build a set of relevance keywords from the business profile.
   * A result must match at least one of these to be considered relevant.
   */
  private buildRelevanceKeywords(
    project: { country?: string | null; industry?: string | null; domain?: string | null } | null | undefined,
    bp: { industry?: string; icp?: { description?: string; industries?: string[] }; positioning?: string } | null | undefined,
  ): string[] {
    const kws: string[] = [];

    // Industry words
    if (bp?.industry) {
      kws.push(...bp.industry.toLowerCase().split(/[\/,&]+/).map(s => s.trim()).filter(Boolean));
    }
    if (project?.industry) {
      kws.push(...project.industry.toLowerCase().split(/[,&]+/).map(s => s.trim()).filter(Boolean));
    }

    // ICP industries
    if (bp?.icp?.industries) {
      for (const ind of bp.icp.industries) {
        kws.push(...ind.toLowerCase().split(/[\/&]+/).map(s => s.trim()).filter(Boolean));
      }
    }

    // Extract key terms from positioning (nouns/meaningful words)
    if (bp?.positioning) {
      const posWords = bp.positioning.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
      // Take unique meaningful words (skip common stopwords)
      const stopwords = new Set(['that', 'this', 'with', 'from', 'also', 'have', 'been', 'more', 'most', 'than', 'their', 'they', 'while', 'itself', 'across']);
      kws.push(...posWords.filter(w => !stopwords.has(w)).slice(0, 15));
    }

    // Domain parts
    if (project?.domain) {
      const domainParts = project.domain.replace(/\.(com|ae|co|net|org|io)$/g, '').split(/[.\-]/);
      kws.push(...domainParts.filter(p => p.length > 2));
    }

    // Deduplicate and return
    return [...new Set(kws)];
  }

  /**
   * Check if a SERP result is relevant to the project's niche.
   */
  private isRelevant(item: SerpItem, relevanceKeywords: string[]): boolean {
    if (relevanceKeywords.length === 0) return true; // no filter if no context

    const text = `${item.title ?? ''} ${item.description ?? ''} ${item.url ?? ''}`.toLowerCase();

    // Must match at least one relevance keyword
    return relevanceKeywords.some(kw => text.includes(kw));
  }

  private async scanTopic(topicId: string, topic: string, projectId: string, country: string, relevanceKeywords: string[]): Promise<number> {
    const [redditResult, quoraResult] = await Promise.allSettled([
      this.dataForSeo.searchRedditThreads(topic, country),
      this.dataForSeo.searchQuoraThreads(topic, country),
    ]);

    if (redditResult.status === 'rejected') {
      this.logger.warn(`Reddit scan failed for "${topic}": ${redditResult.reason}`);
    }
    if (quoraResult.status === 'rejected') {
      this.logger.warn(`Quora scan failed for "${topic}": ${quoraResult.reason}`);
    }

    const items: SerpItem[] = [
      ...(redditResult.status === 'fulfilled' ? redditResult.value : []),
      ...(quoraResult.status === 'fulfilled' ? quoraResult.value : []),
    ];

    let newCount = 0;
    for (const item of items) {
      if (!item.url) continue;

      // Skip irrelevant results
      if (!this.isRelevant(item, relevanceKeywords)) continue;

      const subreddit = item.url.match(/reddit\.com\/r\/([^/]+)/)?.[1] ?? null;
      const isQuestion =
        (item.title ?? '').includes('?') ||
        /\b(how|what|why|where|when|can|should|does|is|are|will|help)\b/i.test(item.title ?? '');
      const publishedDate = item.timestamp ? item.timestamp.split(' ')[0] : null;

      // Compute opportunity score (0-100)
      const score = this.computeScore(publishedDate, isQuestion, item.rank_absolute ?? 20);

      try {
        await this.db.db
          .insert(forumOpportunities)
          .values({
            projectId,
            topicId,
            url: item.url,
            title: item.title ?? '',
            snippet: item.description ?? '',
            subreddit,
            publishedDate,
            isQuestion,
            score,
          })
          .onConflictDoNothing({ target: [forumOpportunities.projectId, forumOpportunities.url] });
        newCount++;
      } catch {
        // duplicate URL — already tracked
      }
    }

    return newCount;
  }

  /**
   * Score an opportunity 0–100 based on:
   * - Recency (newer = higher, max 50 points)
   * - Is a question (20 points)
   * - Lower rank position indicates more relevant (max 30 points)
   */
  private computeScore(publishedDate: string | null, isQuestion: boolean, rank: number): number {
    let score = 0;

    // Recency: max 50 points. Full marks if <7 days old, decays over 90 days.
    if (publishedDate) {
      const ageMs = Date.now() - new Date(publishedDate).getTime();
      const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
      if (ageDays <= 7) score += 50;
      else if (ageDays <= 30) score += 35;
      else if (ageDays <= 90) score += 20;
      else score += 5;
    } else {
      score += 10; // unknown date, give some baseline
    }

    // Question bonus: 20 points
    if (isQuestion) score += 20;

    // Rank relevance: positions 1-5 get full 30, decays to 0 at position 20
    const rankScore = Math.max(0, 30 - Math.floor((Math.max(1, rank) - 1) * (30 / 19)));
    score += rankScore;

    return Math.min(100, score);
  }

  // ─── Run for all projects ────────────────────────────────────

  async runForAllProjects(): Promise<number> {
    // Find all projects that have keywords (i.e. active projects)
    const projectRows = await this.db.db
      .selectDistinct({ projectId: keywords.projectId })
      .from(keywords)
      .limit(50);

    let total = 0;
    for (const row of projectRows) {
      try {
        const count = await this.scanProject(row.projectId);
        total += count;
      } catch (error) {
        this.logger.error(`Forum scan failed for project ${row.projectId}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return total;
  }

  // ─── Query Methods ───────────────────────────────────────────

  async getTopics(projectId: string) {
    return this.db.db.query.forumTopics.findMany({
      where: eq(forumTopics.projectId, projectId),
      orderBy: desc(forumTopics.createdAt),
    });
  }

  async getOpportunities(projectId: string, status?: string) {
    const conditions = [eq(forumOpportunities.projectId, projectId)];
    if (status && ['new', 'seen', 'replied', 'dismissed'].includes(status)) {
      conditions.push(eq(forumOpportunities.status, status as any));
    }

    return this.db.db.query.forumOpportunities.findMany({
      where: and(...conditions),
      orderBy: [desc(forumOpportunities.score), desc(forumOpportunities.discoveredAt)],
      with: { topic: { columns: { topic: true } } },
      limit: 100,
    });
  }

  async updateOpportunityStatus(id: string, projectId: string, status: 'seen' | 'replied' | 'dismissed') {
    await this.db.db
      .update(forumOpportunities)
      .set({ status })
      .where(and(eq(forumOpportunities.id, id), eq(forumOpportunities.projectId, projectId)));
  }

  async addTopic(projectId: string, topic: string) {
    return this.db.db
      .insert(forumTopics)
      .values({ projectId, topic: topic.toLowerCase().trim(), source: 'manual' })
      .onConflictDoNothing({ target: [forumTopics.projectId, forumTopics.topic] })
      .returning();
  }

  async enrichMissingDates(projectId: string): Promise<number> {
    return this.dateEnricher.enrichMissingDates(projectId);
  }

  async testEnrichUrl(url: string) {
    return this.dateEnricher.testUrl(url);
  }

  async removeTopic(id: string, projectId: string) {
    await this.db.db
      .delete(forumTopics)
      .where(and(eq(forumTopics.id, id), eq(forumTopics.projectId, projectId)));
  }

  async getStats(projectId: string) {
    const result = await this.db.db
      .select({
        total: sql<number>`count(*)::int`,
        new: sql<number>`count(*) filter (where ${forumOpportunities.status} = 'new')::int`,
        questions: sql<number>`count(*) filter (where ${forumOpportunities.isQuestion} = true)::int`,
        avgScore: sql<number>`coalesce(avg(${forumOpportunities.score}), 0)::int`,
      })
      .from(forumOpportunities)
      .where(eq(forumOpportunities.projectId, projectId));

    return result[0] ?? { total: 0, new: 0, questions: 0, avgScore: 0 };
  }
}
