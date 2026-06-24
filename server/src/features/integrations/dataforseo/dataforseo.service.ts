import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '../../../shared/utils/retry';
import { ApiUsageContextService } from '../../api-usage/api-usage-context.service';
import { ApiUsageService } from '../../api-usage/api-usage.service';
import { dataforseoEndpointCostUsd } from '../../api-usage/pricing.constants';

/** Maps common ISO country codes and short names to DataForSEO location_name values. */
const LOCATION_MAP: Record<string, string> = {
  us: 'United States',
  uk: 'United Kingdom',
  gb: 'United Kingdom',
  ca: 'Canada',
  au: 'Australia',
  de: 'Germany',
  fr: 'France',
  es: 'Spain',
  it: 'Italy',
  br: 'Brazil',
  in: 'India',
  jp: 'Japan',
  sa: 'Saudi Arabia',
  ae: 'United Arab Emirates',
  uae: 'United Arab Emirates',
  eg: 'Egypt',
  sg: 'Singapore',
  my: 'Malaysia',
  id: 'Indonesia',
  tr: 'Turkey',
  nl: 'Netherlands',
  se: 'Sweden',
  no: 'Norway',
  dk: 'Denmark',
  fi: 'Finland',
  pl: 'Poland',
  za: 'South Africa',
  mx: 'Mexico',
  ar: 'Argentina',
  cl: 'Chile',
  co: 'Colombia',
  ph: 'Philippines',
  th: 'Thailand',
  vn: 'Vietnam',
  kr: 'South Korea',
  tw: 'Taiwan',
  hk: 'Hong Kong',
  nz: 'New Zealand',
  ie: 'Ireland',
  pt: 'Portugal',
  ch: 'Switzerland',
  at: 'Austria',
  be: 'Belgium',
  cz: 'Czechia',
  ro: 'Romania',
  hu: 'Hungary',
  il: 'Israel',
  ng: 'Nigeria',
  ke: 'Kenya',
  pk: 'Pakistan',
  bd: 'Bangladesh',
  qa: 'Qatar',
  kw: 'Kuwait',
  bh: 'Bahrain',
  om: 'Oman',
};

@Injectable()
export class DataForSeoService {
  private readonly logger = new Logger(DataForSeoService.name);
  private readonly login: string;
  private readonly password: string;
  private readonly baseUrl = 'https://api.dataforseo.com/v3';

  constructor(
    private readonly config: ConfigService,
    private readonly apiUsageContext: ApiUsageContextService,
    private readonly apiUsageService: ApiUsageService,
  ) {
    this.login = this.config.get<string>('DATAFORSEO_LOGIN', '');
    this.password = this.config.get<string>('DATAFORSEO_PASSWORD', '');
  }

  // ─── SERP ─────────────────────────────────────────────────

  async getSerpResults(keyword: string, location: string = 'United States', language: string = 'en') {
    return this.post('/serp/google/organic/live/advanced', [
      { keyword, location_name: this.resolveLocation(location), language_code: language },
    ]);
  }

  async searchRedditThreads(query: string, country = 'us', depth = 20) {
    const keyword = `site:reddit.com ${query.trim()}`;
    const raw = (await this.post('/serp/google/organic/live/advanced', [
      { keyword, location_name: this.resolveLocation(country), language_code: 'en', depth },
    ])) as {
      tasks?: Array<{
        result?: Array<{
          items?: Array<{
            type?: string;
            title?: string;
            url?: string;
            description?: string;
            rank_absolute?: number;
            timestamp?: string;
          }>;
        }>;
      }>;
    };
    const items = raw.tasks?.[0]?.result?.[0]?.items ?? [];
    return items.filter((i) => i.type === 'organic');
  }

  // ─── Keywords Data ────────────────────────────────────────

  async getKeywordSearchVolume(keywords: string[], location: string = 'United States', language: string = 'en') {
    return this.post('/keywords_data/google_ads/search_volume/live', [
      { keywords, location_name: this.resolveLocation(location), language_code: language },
    ]);
  }

  async getKeywordSuggestions(keyword: string, location: string = 'United States', language: string = 'en', limit: number = 100) {
    return this.post('/keywords_data/google_ads/keywords_for_keywords/live', [
      { keywords: [keyword], location_name: this.resolveLocation(location), language_code: language, limit },
    ]);
  }

  async getKeywordDifficulty(keywords: string[], location: string = 'United States', language: string = 'en') {
    return this.post('/dataforseo_labs/google/bulk_keyword_difficulty/live', [
      { keywords, location_name: this.resolveLocation(location), language_code: language },
    ]);
  }

  // ─── On-Page ──────────────────────────────────────────────

  async createOnPageTask(url: string): Promise<unknown> {
    // Submit the async on-page crawl task
    const submission = await this.post('/on_page/task_post', [
      { target: url, max_crawl_pages: 100 },
    ]) as { tasks?: Array<{ id?: string; status_code?: number }> };

    const taskId = submission?.tasks?.[0]?.id;
    if (!taskId) {
      throw new Error('DataForSEO on-page task submission did not return a task ID');
    }

    this.logger.log(`DataForSEO on-page task submitted: ${taskId}, polling for completion...`);

    // Poll until crawl_progress === 'finished' (max 3 minutes, 15-second intervals)
    const maxWaitMs = 3 * 60 * 1000;
    const pollIntervalMs = 15_000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise<void>(resolve => setTimeout(resolve, pollIntervalMs));

      const summary = await this.get(`/on_page/summary/${taskId}`) as {
        tasks?: Array<{ status_code?: number; result?: Array<{ crawl_progress?: string }> }>;
      };
      const result = summary?.tasks?.[0]?.result?.[0];

      this.logger.debug(`DataForSEO on-page task ${taskId}: crawl_progress=${result?.crawl_progress}`);

      if (result?.crawl_progress === 'finished') {
        return summary;
      }
      // crawl_progress === 'in_progress' or task still in queue — continue polling
    }

    throw new Error(`DataForSEO on-page task timed out after 3 minutes: ${taskId}`);
  }

  async getOnPageSummary(taskId: string) {
    return this.get(`/on_page/summary/${taskId}`);
  }

  async getOnPagePages(taskId: string, limit: number = 100) {
    return this.post('/on_page/pages', [
      { id: taskId, limit },
    ]);
  }

  // ─── Backlinks ────────────────────────────────────────────

  async getBacklinksSummary(domain: string) {
    return this.post('/backlinks/summary/live', [
      { target: domain, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] },
    ]);
  }

  // ─── Domain Analytics ─────────────────────────────────────

  async getDomainTechnologies(domain: string) {
    return this.post('/domain_analytics/technologies/domain_technologies/live', [
      { target: domain },
    ]);
  }
  // ─── DataForSEO Labs ────────────────────────────────────────────────────────

  async getRankedKeywords(domain: string, location: string = 'United States', language: string = 'en', limit: number = 500) {
    return this.post('/dataforseo_labs/google/ranked_keywords/live', [
      { target: domain, location_name: this.resolveLocation(location), language_code: language, limit, item_types: ['organic'] },
    ]);
  }

  async getBulkKeywordDifficulty(keywords: string[], location: string = 'United States', language: string = 'en') {
    return this.post('/dataforseo_labs/google/bulk_keyword_difficulty/live', [
      { keywords, location_name: this.resolveLocation(location), language_code: language },
    ]);
  }

  async getCompetitorsDomain(domain: string, location: string = 'United States', language: string = 'en', limit: number = 20) {
    return this.post('/dataforseo_labs/google/competitors_domain/live', [
      {
        target: domain,
        location_name: this.resolveLocation(location),
        language_code: language,
        limit,
        item_types: ['organic'],
        exclude_top_domains: true,
      },
    ]);
  }

  /**
   * Enrich an array of keywords with volume and difficulty metrics from DataForSEO.
   * Returns a map of keyword → { volume, difficulty } for matching keywords.
   * Unmatched keywords are absent from the returned map.
   */
  async enrichKeywordsWithMetrics(
    keywords: Array<{ keyword: string; [key: string]: unknown }>,
    location: string = 'United States',
    language: string = 'en',
  ): Promise<Array<{ keyword: string; volume: number | null; difficulty: number | null; [key: string]: unknown }>> {
    if (!keywords.length) return [];

    const keywordStrings = keywords.map(kw => kw.keyword);

    try {
      // Fetch search volume and difficulty in parallel
      const [volumeResp, difficultyResp] = await Promise.all([
        this.getKeywordSearchVolume(keywordStrings, location, language),
        this.getKeywordDifficulty(keywordStrings, location, language),
      ]);

      // Parse volume response: tasks[0].result[].keyword, search_volume
      const volumeMap = new Map<string, number>();
      const volumeItems = (volumeResp as any)?.tasks?.[0]?.result ?? [];
      for (const item of volumeItems) {
        if (item.keyword) {
          volumeMap.set(item.keyword.toLowerCase(), item.search_volume ?? null);
        }
      }

      // Parse difficulty response: tasks[0].result[].keyword, keyword_difficulty
      const difficultyMap = new Map<string, number>();
      const diffItems = (difficultyResp as any)?.tasks?.[0]?.result ?? [];
      for (const item of diffItems) {
        if (item.keyword) {
          difficultyMap.set(item.keyword.toLowerCase(), item.keyword_difficulty ?? null);
        }
      }

      // Merge back into original keywords array
      return keywords.map(kw => ({
        ...kw,
        volume: volumeMap.get(kw.keyword.toLowerCase()) ?? null,
        difficulty: difficultyMap.get(kw.keyword.toLowerCase()) ?? null,
      }));
    } catch (err) {
      this.logger.warn(`enrichKeywordsWithMetrics failed: ${(err as Error).message}. Returning keywords as-is with null metrics.`);
      // On failure, return keywords with null metrics rather than crashing
      return keywords.map(kw => ({
        ...kw,
        volume: null,
        difficulty: null,
      }));
    }
  }

  // ─── Core Request Methods ─────────────────────────────────

  private async post(endpoint: string, data: unknown[]): Promise<unknown> {
    return this.request('POST', endpoint, data);
  }

  private async get(endpoint: string): Promise<unknown> {
    return this.request('GET', endpoint);
  }

  private async request(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    if (!this.login || !this.password) {
      throw new Error('DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are not configured');
    }

    const credentials = Buffer.from(`${this.login}:${this.password}`).toString('base64');
    const url = `${this.baseUrl}${endpoint}`;

    this.logger.debug(`DataForSEO API: ${method} ${endpoint}`);
    const callStart = Date.now();

    return withRetry(
      async () => {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30_000),
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(`DataForSEO API error: ${response.status}`);
          throw new Error(`DataForSEO API error: ${response.status}`);
        }

        const result = await response.json() as { tasks?: Array<{ status_code?: number; status_message?: string }> };

        // Check task-level errors (DataForSEO returns HTTP 200 with error details inside tasks).
        // 20000 = OK (data ready), 20100 = Task Created (success for async task_post endpoints).
        // Only throw on 40xxx (client error) and 50xxx (server error).
        const task = result.tasks?.[0];
        if (task && task.status_code && task.status_code >= 40000) {
          const msg = `DataForSEO task error ${task.status_code}: ${task.status_message ?? 'unknown'}`;
          this.logger.error(msg);
          throw new Error(msg);
        }

        // Record API usage — fire-and-forget
        const ctx = this.apiUsageContext.getContext();
        if (ctx) {
          this.apiUsageService.record({
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            workflowRunId: ctx.workflowRunId,
            stepKey: ctx.stepKey,
            provider: 'dataforseo',
            endpoint,
            costUsd: dataforseoEndpointCostUsd(endpoint),
            durationMs: Date.now() - callStart,
            success: true,
          });
        }

        return result;
      },
      { label: `DataForSEO ${method} ${endpoint}` },
    );
  }

  /** Resolve ISO country codes or short names to DataForSEO location_name values. */
  private resolveLocation(location: string): string {
    const key = location.trim().toLowerCase();
    // If it's a known ISO code or abbreviation, map it
    if (LOCATION_MAP[key]) {
      return LOCATION_MAP[key];
    }
    // Otherwise pass through as-is (already a full name like "Saudi Arabia")
    return location;
  }
}
