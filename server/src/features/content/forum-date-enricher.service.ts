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
    const cleanUrl = url.replace(/^https?:\/\//, '').split('?')[0];
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanUrl)}` +
      `&output=json&limit=1&fl=timestamp&filter=statuscode:200&from=2005&to=${new Date().getFullYear() + 1}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const response = await fetch(cdxUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'OrganiqBot/1.0 (+https://app.rankorganiq.com/bot)' },
      });
      clearTimeout(timer);
      if (!response.ok) return { url, date: null, detail: `Wayback CDX HTTP ${response.status}` };
      const data = await response.json() as string[][];
      if (!data || data.length < 2) return { url, date: null, detail: `Wayback: no archive (rows=${data?.length ?? 0})` };
      const ts = data[1]?.[0] ?? '';
      const date = ts.length >= 8 ? `${ts.substring(0,4)}-${ts.substring(4,6)}-${ts.substring(6,8)}` : null;
      return { url, date, detail: `Wayback ts=${ts} rows=${data.length}` };
    } catch (err) {
      return { url, date: null, detail: `exception: ${err instanceof Error ? err.message : err}` };
    }
  }

  private async testQuora(url: string): Promise<{ url: string; date: string | null; detail: string }> {
    // Try Wayback first
    const waybackDate = await (async () => {
      const cleanUrl = url.replace(/^https?:\/\//, '').split('?')[0];
      const cdxUrl =
        `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanUrl)}` +
        `&output=json&limit=1&fl=timestamp&filter=statuscode:200&from=2005&to=${new Date().getFullYear() + 1}`;
      try {
        const r = await fetch(cdxUrl, { headers: { 'User-Agent': 'OrganiqBot/1.0' }, signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return { date: null, detail: `CDX HTTP ${r.status}` };
        const data = await r.json() as string[][];
        if (!data || data.length < 2) return { date: null, detail: `CDX no archive rows=${data?.length ?? 0}` };
        const ts = data[1]?.[0] ?? '';
        const date = ts.length >= 8 ? `${ts.substring(0,4)}-${ts.substring(4,6)}-${ts.substring(6,8)}` : null;
        return { date, detail: `CDX ts=${ts}` };
      } catch (e) { return { date: null, detail: `CDX exception: ${e instanceof Error ? e.message : e}` }; }
    })();
    if (waybackDate.date) return { url, date: waybackDate.date, detail: waybackDate.detail };

    // Fallback: Firecrawl
    try {
      const result = (await this.firecrawl.scrape(url, {
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 2000,
      })) as { data?: { rawHtml?: string } } | null;
      const html = result?.data?.rawHtml ?? '';
      if (!html) return { url, date: null, detail: `wayback: ${waybackDate.detail} | firecrawl: empty` };
      const hasNextData = html.includes('__NEXT_DATA__');
      const nextDataDate = hasNextData ? this.extractQuoraNextData(html) : null;
      const fallbackDate = this.extractDateFromHtml(html);
      const date = nextDataDate ?? fallbackDate;
      return { url, date, detail: `wayback: ${waybackDate.detail} | fc htmlLen=${html.length} hasNextData=${hasNextData} nextDate=${nextDataDate} fb=${fallbackDate}` };
    } catch (err) {
      return { url, date: null, detail: `wayback: ${waybackDate.detail} | firecrawl exception: ${err instanceof Error ? err.message : err}` };
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

  // ─── Shared: Wayback Machine CDX API ──────────────────────────

  /**
   * Use the Wayback Machine CDX API to find the earliest archived date
   * for a URL. Works reliably for both Reddit and Quora from any IP.
   * Returns YYYY-MM-DD or null if no archive exists.
   */
  private async resolveViaWayback(url: string): Promise<string | null> {
    const cleanUrl = url.replace(/^https?:\/\//, '').split('?')[0];
    const cdxUrl =
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanUrl)}` +
      `&output=json&limit=1&fl=timestamp&filter=statuscode:200&from=2005&to=${new Date().getFullYear() + 1}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const response = await fetch(cdxUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'OrganiqBot/1.0 (+https://app.rankorganiq.com/bot)' },
      });
      clearTimeout(timer);
      if (!response.ok) {
        this.logger.warn(`Wayback CDX ${response.status} for ${url}`);
        return null;
      }
      const data = await response.json() as string[][];
      if (!data || data.length < 2) return null;
      const ts = data[1]?.[0];
      if (!ts || ts.length < 8) return null;
      return `${ts.substring(0, 4)}-${ts.substring(4, 6)}-${ts.substring(6, 8)}`;
    } catch (err) {
      this.logger.warn(`Wayback CDX failed for ${url}: ${err instanceof Error ? err.message : err}`);
    }
    return null;
  }

  // ─── Reddit: Wayback Machine CDX API ─────────────────────────

  /**
   * Reddit 403s all requests from AWS EC2 IP ranges.
   * Wayback Machine CDX returns the earliest archive date as a reliable proxy.
   */
  private async resolveRedditDate(url: string): Promise<string | null> {
    return this.resolveViaWayback(url);
  }

  // ─── Quora: Wayback CDX first, Firecrawl + __NEXT_DATA__ fallback ──

  /**
   * Use Wayback CDX (fast, free) then fall back to Firecrawl + __NEXT_DATA__
   * parsing if Wayback has no archive for this URL.
   */
  private async resolveQuoraDate(url: string): Promise<string | null> {
    // Primary: Wayback Machine
    const waybackDate = await this.resolveViaWayback(url);
    if (waybackDate) return waybackDate;

    // Fallback: Firecrawl renders the JS page; extract from __NEXT_DATA__ or meta
    try {
      const result = (await this.firecrawl.scrape(url, {
        formats: ['rawHtml'],
        onlyMainContent: false,
        waitFor: 2000,
      })) as { data?: { rawHtml?: string } } | null;

      const html = result?.data?.rawHtml ?? '';
      if (!html) return null;

      const nextDataDate = this.extractQuoraNextData(html);
      if (nextDataDate) return nextDataDate;

      return this.extractDateFromHtml(html);
    } catch (err) {
      this.logger.warn(
        `Firecrawl Quora fallback failed for ${url}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return null;
  }

  /**
   * Quora embeds all page data in a <script id="__NEXT_DATA__"> JSON blob.
   * Extract the question's creation time from it.
   */
  private extractQuoraNextData(html: string): string | null {
    const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>(\{[\s\S]*?\})<\/script>/);
    if (!match) return null;

    try {
      const json = JSON.parse(match[1]);
      const text = JSON.stringify(json);

      // Quora uses several possible timestamp fields (Unix seconds or ms)
      const patterns = [
        /"createdTime"\s*:\s*(\d{9,13})/,
        /"questionCreatedTime"\s*:\s*(\d{9,13})/,
        /"created_time"\s*:\s*(\d{9,13})/,
        /"creationTime"\s*:\s*(\d{9,13})/,
        /"addedTime"\s*:\s*(\d{9,13})/,
      ];

      for (const pat of patterns) {
        const m = text.match(pat);
        if (m) {
          const ts = parseInt(m[1], 10);
          // Auto-detect seconds vs ms by magnitude
          const ms = ts < 1e11 ? ts * 1000 : ts;
          const d = new Date(ms);
          if (!isNaN(d.getTime()) && d.getFullYear() > 2009) {
            return d.toISOString().split('T')[0];
          }
        }
      }
    } catch { /* malformed JSON */ }

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
