import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  // ─── Site Explorer ─────────────────────────────────────────

  async getDomainRating(domain: string) {
    return this.request({
      endpoint: '/site-explorer/domain-rating',
      params: { target: domain },
    });
  }

  async getOrganicKeywords(domain: string, country: string = 'us', limit: number = 1000) {
    return this.request({
      endpoint: '/site-explorer/organic-keywords',
      params: { target: domain, country, limit, mode: 'domain' },
    });
  }

  async getOrganicPages(domain: string, country: string = 'us', limit: number = 100) {
    return this.request({
      endpoint: '/site-explorer/top-pages',
      params: { target: domain, country, limit, mode: 'domain' },
    });
  }

  async getBacklinksStats(domain: string) {
    return this.request({
      endpoint: '/site-explorer/backlinks-stats',
      params: { target: domain, mode: 'domain' },
    });
  }

  async getCompetingDomains(domain: string, country: string = 'us', limit: number = 20) {
    return this.request({
      endpoint: '/site-explorer/competing-domains',
      params: { target: domain, country, limit, mode: 'domain' },
    });
  }

  // ─── Keywords Explorer ─────────────────────────────────────

  async getKeywordDifficulty(keywords: string[], country: string = 'us') {
    return this.request({
      endpoint: '/keywords-explorer/keyword-difficulty',
      params: { keywords: keywords.join(','), country },
    });
  }

  async getKeywordVolume(keywords: string[], country: string = 'us') {
    return this.request({
      endpoint: '/keywords-explorer/volume',
      params: { keywords: keywords.join(','), country },
    });
  }

  async getRelatedKeywords(keyword: string, country: string = 'us', limit: number = 100) {
    return this.request({
      endpoint: '/keywords-explorer/related-terms',
      params: { keyword, country, limit },
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
      url.searchParams.set(key, String(value));
    }

    this.logger.debug(`Ahrefs API: ${endpoint}`);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Ahrefs API error: ${response.status}`);
      throw new Error(`Ahrefs API error: ${response.status}`);
    }

    return response.json();
  }
}
