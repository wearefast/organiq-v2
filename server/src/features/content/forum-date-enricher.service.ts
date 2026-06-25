import { Injectable, Logger } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { FirecrawlService } from '../integrations/firecrawl/firecrawl.service';
import { forumOpportunities } from '../../db/schema';

/**
 * ForumDateEnricherService
 *
 * DataForSEO's `timestamp` field is frequently absent for SERP results,
 * causing `publishedDate = null` in the DB. This service resolves dates
 * after each scan using source-specific strategies:
 *
 * Reddit:
 *   - Append `.json` to the thread URL to call Reddit's public JSON API
 *   - Parse `created_utc` (Unix timestamp) from the response
 *   - Free, reliable, no bot detection
 *
 * Quora:
 *   - Quora blocks plain HTTP bots; Firecrawl renders the page with a
 *     headless browser and returns HTML with Open Graph meta tags or JSON-LD
 *   - Extract `article:published_time` or `datePublished` from rendered HTML
 */
@Injectable()
export class ForumDateEnricherService {
  private readonly logger = new Logger(ForumDateEnricherService.name);

  // Reddit API requires a descriptive User-Agent (their policy)
  private readonly REDDIT_UA = 'OrganiqBot/1.0 (by /u/organiqbot; for date enrichment)';

  // Delay between individual requests to avoid rate limiting
  private readonly INTER_REQUEST_DELAY_MS = 600;

  constructor(
    private readonly db: DatabaseService,
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
      .limit(50); // cap per batch to keep memory bounded

    const ids = undated.map((r) => r.id);
    await this.enrichBatch(ids);
    return ids.length;
  }

  // ─── Core Resolution ─────────────────────────────────────────

  /**
   * Publicly test a single URL — used by the diagnostics endpoint.
   */
  async testUrl(url: string): Promise<{ url: string; date: string | null; detail: string }> {
    if (url.includes('reddit.com')) {
      return this.testReddit(url);
    }
    if (url.includes('quora.com')) {
      return this.testQuora(url);
    }
    return { url, date: null, detail: 'unsupported source' };
  }

  private async testReddit(url: string): Promise<{ url: string; date: string | null; detail: string }> {
    const base = url.split('?')[0].replace(/\/?$/, '/');
    const jsonUrl = `${base}.json?raw_json=1&limit=1`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(jsonUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': this.REDDIT_UA, 'Accept': 'application/json' },
      });
      clearTimeout(timer);
      if (!response.ok) {
        const text = await response.text();
        return { url, date: null, detail: `HTTP ${response.status}: ${text.substring(0, 200)}` };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;
      const createdUtc = data?.[0]?.data?.children?.[0]?.data?.created_utc;
      const date = typeof createdUtc === 'number' ? new Date(createdUtc * 1000).toISOString().split('T')[0] : null;
      return { url, date, detail: `created_utc=${createdUtc}` };
    } catch (err) {
      return { url, date: null, detail: `exception: ${err instanceof Error ? err.message : err}` };
    }
  }

  private async testQuora(url: string): Promise<{ url: string; date: string | null; detail: string }> {
    try {
      const result = (await this.firecrawl.scrape(url, {
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 2000,
      })) as { data?: { rawHtml?: string } } | null;
      const html = result?.data?.rawHtml ?? '';
      if (!html) return { url, date: null, detail: 'firecrawl returned empty html' };
      const date = this.extractDateFromHtml(html);
      const ogHint = html.includes('article:published_time') ? 'has og:date' : 'no og:date';
      const timeHint = html.match(/<time[^>]+datetime/i)?.[0]?.substring(0, 80) ?? 'no time tag';
      return { url, date, detail: `htmlLen=${html.length} ${ogHint} timeTag=${timeHint}` };
    } catch (err) {
      return { url, date: null, detail: `firecrawl exception: ${err instanceof Error ? err.message : err}` };
    }
  }

  /**
   * Route to the right strategy based on source domain.
   * Returns "YYYY-MM-DD" or null.
   */
  private async resolveDate(url: string): Promise<string | null> {
    if (url.includes('reddit.com')) {
      return this.resolveRedditDate(url);
    }
    if (url.includes('quora.com')) {
      return this.resolveQuoraDate(url);
    }
    return null;
  }

  // ─── Reddit: Public JSON API ──────────────────────────────────

  /**
   * Reddit's public JSON API returns `created_utc` (Unix seconds) reliably.
   * No authentication needed. Append `.json` to any thread URL.
   *
   * e.g. https://www.reddit.com/r/x/comments/abc/title/.json
   */
  private async resolveRedditDate(url: string): Promise<string | null> {
    try {
      // Build the .json URL — strip query string first, ensure trailing slash before .json
      const base = url.split('?')[0].replace(/\/?$/, '/');
      const jsonUrl = `${base}.json?raw_json=1&limit=1`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(jsonUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': this.REDDIT_UA,
          'Accept': 'application/json',
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        this.logger.warn(`Reddit JSON API ${response.status} for ${url}`);
        return null;
      }

      // Reddit JSON API returns an array: [listing, comments_listing]
      // The post data is in [0].data.children[0].data.created_utc
      const data = await response.json() as Array<{
        data?: {
          children?: Array<{
            data?: { created_utc?: number };
          }>;
        };
      }>;

      const createdUtc = data?.[0]?.data?.children?.[0]?.data?.created_utc;
      if (typeof createdUtc === 'number' && createdUtc > 0) {
        return new Date(createdUtc * 1000).toISOString().split('T')[0];
      }
    } catch (err) {
      this.logger.warn(
        `Reddit JSON API failed for ${url}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return null;
  }

  // ─── Quora: Firecrawl (renders JS, bypasses bot detection) ───

  /**
   * Quora blocks plain HTTP bots. Firecrawl renders the page with a headless
   * browser and returns rawHtml that contains Open Graph or JSON-LD date metadata.
   */
  private async resolveQuoraDate(url: string): Promise<string | null> {
    try {
      const result = (await this.firecrawl.scrape(url, {
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 2000,
      })) as { data?: { rawHtml?: string } } | null;

      const html = result?.data?.rawHtml ?? '';
      if (!html) return null;

      return this.extractDateFromHtml(html);
    } catch (err) {
      this.logger.warn(
        `Firecrawl failed for ${url}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return null;
  }

  // ─── HTML Date Extraction ─────────────────────────────────────

  private extractDateFromHtml(html: string): string | null {
    // 1. JSON-LD datePublished / dateCreated
    const scriptBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of scriptBlocks) {
      try {
        const json = JSON.parse(block[1]);
        const nodes = Array.isArray(json) ? json : [json];
        for (const node of nodes) {
          const raw = node?.datePublished ?? node?.dateCreated;
          if (raw) {
            const d = this.parseToIso(String(raw));
            if (d) return d;
          }
        }
      } catch { /* malformed JSON-LD */ }
    }

    // 2. <meta property="article:published_time">
    const ogMatch =
      html.match(/property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i)?.[1];
    if (ogMatch) {
      const d = this.parseToIso(ogMatch);
      if (d) return d;
    }

    // 3. <time datetime="..."> — first occurrence
    const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1];
    if (timeMatch) {
      const d = this.parseToIso(timeMatch);
      if (d) return d;
    }

    // 4. Quora "Asked X ago" / "Asked [date]" visible text patterns
    const absoluteMatch = html.match(/Asked\s*[·•]?\s*([A-Za-z]+ \d{1,2},? \d{4})/i)?.[1];
    if (absoluteMatch) {
      const d = this.parseToIso(absoluteMatch);
      if (d) return d;
    }

    const relMatch = html.match(/Asked\s*[·•]?\s*(\d+)\s+(year|month|week|day|hour)s?\s+ago/i);
    if (relMatch) {
      return this.relativeToIso(parseInt(relMatch[1], 10), relMatch[2].toLowerCase());
    }

    return null;
  }

  // ─── Date Parsing Utilities ──────────────────────────────────

  private parseToIso(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();

    // Unix seconds (10-digit)
    if (/^\d{10}$/.test(trimmed)) {
      return new Date(parseInt(trimmed, 10) * 1000).toISOString().split('T')[0];
    }
    // Unix ms (13-digit)
    if (/^\d{13}$/.test(trimmed)) {
      return new Date(parseInt(trimmed, 10)).toISOString().split('T')[0];
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() <= new Date().getFullYear() + 1) {
      return d.toISOString().split('T')[0];
    }
    return null;
  }

  private relativeToIso(amount: number, unit: string): string | null {
    const now = new Date();
    switch (unit) {
      case 'year':  now.setFullYear(now.getFullYear() - amount); break;
      case 'month': now.setMonth(now.getMonth() - amount); break;
      case 'week':  now.setDate(now.getDate() - amount * 7); break;
      case 'day':   now.setDate(now.getDate() - amount); break;
      case 'hour':  now.setHours(now.getHours() - amount); break;
      default:      return null;
    }
    return now.toISOString().split('T')[0];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
