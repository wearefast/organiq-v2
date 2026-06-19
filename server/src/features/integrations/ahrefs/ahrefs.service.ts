import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '../../../shared/utils/retry';

interface AhrefsRequestOptions {
  endpoint: string;
  params: Record<string, string | number>;
}

@Injectable()
export class AhrefsService {
  private readonly logger = new Logger(AhrefsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.ahrefs.com/v3';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AHREFS_API_KEY', '');
  }

  /** Returns a recent date string (3 days ago) for Ahrefs v3 date param */
  private getRecentDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  }

  // ─── Site Explorer ─────────────────────────────────────────

  async getDomainRating(domain: string) {
    return this.request({
      endpoint: '/site-explorer/domain-rating',
      params: { target: domain, date: this.getRecentDate() },
    });
  }

  async getOrganicKeywords(domain: string, country: string = 'us', limit: number = 50) {
    return this.request({
      endpoint: '/site-explorer/organic-keywords',
      params: {
        target: domain,
        country,
        limit,
        mode: 'domain',
        date: this.getRecentDate(),
        select: 'keyword,volume,keyword_difficulty,best_position,best_position_url,sum_traffic,cpc',
      },
    });
  }

  async getOrganicPages(domain: string, country: string = 'us', limit: number = 100) {
    return this.request({
      endpoint: '/site-explorer/top-pages',
      params: {
        target: domain,
        country,
        limit,
        mode: 'domain',
        date: this.getRecentDate(),
        select: 'url,sum_traffic,top_keyword,top_keyword_best_position,top_keyword_volume,keywords',
      },
    });
  }

  async getBacklinksStats(domain: string) {
    return this.request({
      endpoint: '/site-explorer/backlinks-stats',
      params: { target: domain, mode: 'domain', date: this.getRecentDate() },
    });
  }

  async getCompetingDomains(domain: string, country: string = 'us', limit: number = 20) {
    return this.request({
      endpoint: '/site-explorer/organic-competitors',
      params: {
        target: domain,
        country,
        limit,
        mode: 'domain',
        date: this.getRecentDate(),
        select: 'competitor_domain,keywords_common,keywords_competitor,keywords_target,traffic,share,domain_rating',
      },
    });
  }

  // ─── Keywords Explorer ─────────────────────────────────────

  async getKeywordDifficulty(keywords: string[], country: string = 'us') {
    return this.request({
      endpoint: '/keywords-explorer/overview',
      params: {
        keywords: keywords.join(','),
        country,
        select: 'keyword,difficulty,volume',
      },
    });
  }

  async getKeywordVolume(keywords: string[], country: string = 'us') {
    return this.request({
      endpoint: '/keywords-explorer/overview',
      params: {
        keywords: keywords.join(','),
        country,
        select: 'keyword,volume,cpc,difficulty,global_volume,traffic_potential',
      },
    });
  }

  async getRelatedKeywords(keyword: string, country: string = 'us', limit: number = 20) {
    return this.request({
      endpoint: '/keywords-explorer/related-terms',
      params: {
        keywords: keyword,
        country,
        limit,
        select: 'keyword,volume,difficulty,cpc,traffic_potential,parent_topic',
      },
    });
  }

  async getMatchingTerms(keyword: string, country: string = 'us', limit: number = 100) {
    return this.request({
      endpoint: '/keywords-explorer/matching-terms',
      params: {
        keywords: keyword,
        country,
        limit,
        order_by: 'volume',
        select: 'keyword,volume,difficulty,cpc,traffic_potential,parent_topic',
      },
    });
  }

  async getSerpOverview(keyword: string, country: string = 'us') {
    return this.request({
      endpoint: '/serp-overview/serp-overview',
      params: {
        keyword,
        country,
        top_positions: 10,
        output: 'json',
        select:
          'position,url,title,type,domain_rating,url_rating,traffic,keywords,backlinks,refdomains,page_type,top_keyword,top_keyword_volume,value,update_date',
      },
    });
  }

  // ─── Brand Radar ───────────────────────────────────────────

  async getBrandMentions(domain: string, limit: number = 100) {
    return this.request({
      endpoint: '/site-explorer/brand-radar',
      params: { target: domain, limit },
    });
  }

  // ─── Core Request ──────────────────────────────────────────

  private async request({ endpoint, params }: AhrefsRequestOptions): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error('AHREFS_API_KEY is not configured');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      // Ahrefs v3 requires lowercase country codes
      const normalizedValue = key === 'country' ? String(value).toLowerCase() : String(value);
      url.searchParams.set(key, normalizedValue);
    }

    // Log key params (target/keywords) for traceability without leaking the API key
    const traceable = ['target', 'keywords', 'keyword', 'country'].reduce<string[]>((acc, key) => {
      if (params[key]) acc.push(`${key}="${String(params[key]).slice(0, 60)}"`);
      return acc;
    }, []);
    this.logger.log(`Ahrefs → GET ${endpoint}${traceable.length ? ' ' + traceable.join(' ') : ''}`);
    const reqStart = Date.now();

    return withRetry(
      async () => {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(30_000),
        });

        const durationMs = Date.now() - reqStart;

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(
            `Ahrefs ✗ GET ${endpoint} status=${response.status} duration=${durationMs}ms body=${text.slice(0, 300)}`,
          );
          throw new Error(`Ahrefs API error: ${response.status}`);
        }

        this.logger.log(`Ahrefs ✓ GET ${endpoint} duration=${durationMs}ms`);
        return response.json();
      },
      { label: `Ahrefs ${endpoint}` },
    );
  }
}
