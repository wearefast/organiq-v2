import { Injectable, Logger } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { WebCrawlerService } from '../../shared/web-crawler/web-crawler.service';
import { FirecrawlService } from '../integrations/firecrawl/firecrawl.service';
import { forumOpportunities } from '../../db/schema';

/**
 * ForumDateEnricherService
 *
 * DataForSEO's `timestamp` field is frequently absent for SERP results,
 * causing `publishedDate = null` in the DB. This service scrapes each
 * undated URL after a scan completes to extract the actual published date.
 *
 * Strategy chain (cheapest first):
 *   1. JSON-LD `datePublished` (script tag, free fetch)
 *   2. <meta property="article:published_time">
 *   3. <meta name="date">
 *   4. <time datetime="..."> first occurrence
 *   5. Reddit: data-timestamp attribute (Unix ms)
 *   6. Reddit: "created_utc" in inline JSON
 *   7. Quora: "Asked X ago" relative text
 *   8. Firecrawl rendered HTML fallback (paid, only if all above fail)
 */
@Injectable()
export class ForumDateEnricherService {
  private readonly logger = new Logger(ForumDateEnricherService.name);

  // Delay between individual URL fetches to avoid IP bans
  private readonly INTER_REQUEST_DELAY_MS = 400;

  constructor(
    private readonly db: DatabaseService,
    private readonly webCrawler: WebCrawlerService,
    private readonly firecrawl: FirecrawlService,
  ) {}

  /**
   * Enrich a batch of opportunity IDs that have no publishedDate.
   * Runs sequentially with a small delay between each to avoid rate-limiting.
   * Designed to be called fire-and-forget (void) from the scan pipeline.
   */
  async enrichBatch(opportunityIds: string[]): Promise<void> {
    if (opportunityIds.length === 0) return;
    this.logger.log(`Starting date enrichment for ${opportunityIds.length} opportunities`);

    let enriched = 0;
    for (const id of opportunityIds) {
      try {
        const opp = await this.db.db.query.forumOpportunities.findFirst({
          where: eq(forumOpportunities.id, id),
          columns: { id: true, url: true, publishedDate: true },
        });

        if (!opp?.url || opp.publishedDate) continue; // already has date or no URL

        const date = await this.resolveDate(opp.url);
        if (date) {
          await this.db.db
            .update(forumOpportunities)
            .set({ publishedDate: date })
            .where(eq(forumOpportunities.id, id));
          enriched++;
        }

        await this.delay(this.INTER_REQUEST_DELAY_MS);
      } catch (err) {
        this.logger.warn(
          `Enrichment failed for opportunity ${id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.logger.log(`Date enrichment complete: ${enriched}/${opportunityIds.length} resolved`);
  }

  /**
   * Query all undated opportunities for a project and enrich them.
   * Used for the manual backfill endpoint and first-run hydration.
   */
  async enrichMissingDates(projectId: string): Promise<number> {
    const undated = await this.db.db
      .select({ id: forumOpportunities.id })
      .from(forumOpportunities)
      .where(and(eq(forumOpportunities.projectId, projectId), isNull(forumOpportunities.publishedDate)))
      .limit(100); // cap to avoid runaway enrichment on large backlogs

    const ids = undated.map((r) => r.id);
    await this.enrichBatch(ids);
    return ids.length;
  }

  // ─── Core Resolution ─────────────────────────────────────────

  /**
   * Attempt to resolve a published date for a URL.
   * Returns an ISO date string ("YYYY-MM-DD") or null.
   */
  private async resolveDate(url: string): Promise<string | null> {
    // Stage 1: free static HTML fetch
    const html = await this.webCrawler.fetchText(url, 8_000);
    if (html) {
      const date = this.extractFromHtml(html, url);
      if (date) return date;
    }

    // Stage 2: Firecrawl (renders JS, costs credits — only if Stage 1 failed)
    try {
      const result = (await this.firecrawl.scrape(url, {
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 1500,
      })) as { data?: { rawHtml?: string }; rawHtml?: string } | null;

      const renderedHtml = result?.data?.rawHtml ?? (result as any)?.rawHtml ?? '';
      if (renderedHtml) {
        const date = this.extractFromHtml(renderedHtml, url);
        if (date) return date;
      }
    } catch (err) {
      this.logger.debug(
        `Firecrawl fallback failed for ${url}: ${err instanceof Error ? err.message : err}`,
      );
    }

    return null;
  }

  // ─── Extraction Strategy Chain ───────────────────────────────

  private extractFromHtml(html: string, url: string): string | null {
    // Strategy 1: JSON-LD datePublished
    const jsonLdDate = this.extractJsonLdDate(html);
    if (jsonLdDate) return jsonLdDate;

    // Strategy 2: <meta property="article:published_time">
    const ogDate = this.extractMetaTag(html, /property=["']article:published_time["']\s+content=["']([^"']+)["']/i)
      ?? this.extractMetaTag(html, /content=["']([^"']+)["']\s+property=["']article:published_time["']/i);
    if (ogDate) return ogDate;

    // Strategy 3: <meta name="date">
    const metaDate = this.extractMetaTag(html, /name=["']date["']\s+content=["']([^"']+)["']/i)
      ?? this.extractMetaTag(html, /content=["']([^"']+)["']\s+name=["']date["']/i);
    if (metaDate) return metaDate;

    // Strategy 4: <time datetime="...">
    const timeEl = html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
    if (timeEl) {
      const parsed = this.parseToIso(timeEl);
      if (parsed) return parsed;
    }

    // Reddit-specific strategies
    if (url.includes('reddit.com')) {
      const redditDate = this.extractRedditDate(html);
      if (redditDate) return redditDate;
    }

    // Quora-specific strategies
    if (url.includes('quora.com')) {
      const quoraDate = this.extractQuoraDate(html);
      if (quoraDate) return quoraDate;
    }

    return null;
  }

  private extractJsonLdDate(html: string): string | null {
    const scriptBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of scriptBlocks) {
      try {
        const json = JSON.parse(block[1]);
        const candidates = Array.isArray(json) ? json : [json];
        for (const node of candidates) {
          const raw = node?.datePublished ?? node?.dateCreated ?? node?.uploadDate;
          if (raw) {
            const parsed = this.parseToIso(String(raw));
            if (parsed) return parsed;
          }
        }
      } catch {
        // malformed JSON-LD — skip
      }
    }
    return null;
  }

  private extractMetaTag(html: string, pattern: RegExp): string | null {
    const match = html.match(pattern)?.[1];
    if (!match) return null;
    return this.parseToIso(match);
  }

  private extractRedditDate(html: string): string | null {
    // Strategy 5: data-timestamp="NNNNN" (milliseconds) on .thing element
    const dataTs = html.match(/data-timestamp=["'](\d{10,13})["']/)?.[1];
    if (dataTs) {
      const parsed = this.parseToIso(dataTs);
      if (parsed) return parsed;
    }

    // Strategy 6: "created_utc":NNNNNNNNNN in inline JSON (seconds)
    const createdUtc = html.match(/"created_utc"\s*:\s*(\d{9,10})/)?.[1];
    if (createdUtc) {
      const parsed = this.parseToIso(createdUtc + '000'); // seconds → ms
      if (parsed) return parsed;
    }

    // Strategy 6b: shreddit (new reddit) data-created-timestamp
    const shredditTs = html.match(/data-created-timestamp=["']([^"']+)["']/)?.[1];
    if (shredditTs) {
      const parsed = this.parseToIso(shredditTs);
      if (parsed) return parsed;
    }

    return null;
  }

  private extractQuoraDate(html: string): string | null {
    // Strategy 7: Quora "Asked [date]" patterns
    // e.g. "Asked March 15, 2024", "Asked 3 years ago", "Asked · 2 years ago"
    const askedPattern = /Asked\s*[·•]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i;
    const askedMatch = html.match(askedPattern)?.[1];
    if (askedMatch) {
      const parsed = this.parseToIso(askedMatch);
      if (parsed) return parsed;
    }

    // Relative: "Asked 3 years ago", "Asked 6 months ago"
    const relativePattern = /Asked\s*[·•]?\s*(\d+)\s+(year|month|week|day|hour)s?\s+ago/i;
    const relMatch = html.match(relativePattern);
    if (relMatch) {
      const amount = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      return this.relativeToIso(amount, unit);
    }

    return null;
  }

  // ─── Date Parsing Utilities ──────────────────────────────────

  /**
   * Normalize any raw date string/number to "YYYY-MM-DD".
   * Handles ISO strings, Unix timestamps (10-digit seconds / 13-digit ms),
   * and human-readable date strings.
   */
  private parseToIso(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();

    // Unix timestamp: 10-digit (seconds) or 13-digit (ms)
    if (/^\d{10}$/.test(trimmed)) {
      return new Date(parseInt(trimmed, 10) * 1000).toISOString().split('T')[0];
    }
    if (/^\d{13}$/.test(trimmed)) {
      return new Date(parseInt(trimmed, 10)).toISOString().split('T')[0];
    }

    // ISO-8601 or parseable date string
    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() <= new Date().getFullYear() + 1) {
      return d.toISOString().split('T')[0];
    }

    return null;
  }

  /**
   * Convert a relative time expression ("3 years ago") to ISO date.
   */
  private relativeToIso(amount: number, unit: string): string | null {
    const now = new Date();
    switch (unit) {
      case 'year':   now.setFullYear(now.getFullYear() - amount); break;
      case 'month':  now.setMonth(now.getMonth() - amount); break;
      case 'week':   now.setDate(now.getDate() - amount * 7); break;
      case 'day':    now.setDate(now.getDate() - amount); break;
      case 'hour':   now.setHours(now.getHours() - amount); break;
      default:       return null;
    }
    return now.toISOString().split('T')[0];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
