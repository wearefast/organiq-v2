import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DataForSeoService {
  private readonly logger = new Logger(DataForSeoService.name);
  private readonly login: string;
  private readonly password: string;
  private readonly baseUrl = 'https://api.dataforseo.com/v3';

  constructor(private readonly config: ConfigService) {
    this.login = this.config.get<string>('DATAFORSEO_LOGIN', '');
    this.password = this.config.get<string>('DATAFORSEO_PASSWORD', '');
  }

  // ─── SERP ─────────────────────────────────────────────────

  async getSerpResults(keyword: string, location: string = 'United States', language: string = 'en') {
    return this.post('/serp/google/organic/live/advanced', [
      { keyword, location_name: location, language_name: language },
    ]);
  }

  // ─── Keywords Data ────────────────────────────────────────

  async getKeywordSearchVolume(keywords: string[], location: string = 'United States', language: string = 'en') {
    return this.post('/keywords_data/google_ads/search_volume/live', [
      { keywords, location_name: location, language_name: language },
    ]);
  }

  async getKeywordSuggestions(keyword: string, location: string = 'United States', language: string = 'en', limit: number = 100) {
    return this.post('/keywords_data/google_ads/keywords_for_keywords/live', [
      { keywords: [keyword], location_name: location, language_name: language, limit },
    ]);
  }

  async getKeywordDifficulty(keywords: string[], location: string = 'United States', language: string = 'en') {
    return this.post('/keywords_data/google_ads/search_volume/live', [
      { keywords, location_name: location, language_name: language, calculate_relevance: true },
    ]);
  }

  // ─── On-Page ──────────────────────────────────────────────

  async createOnPageTask(url: string) {
    return this.post('/on_page/task_post', [
      { target: url, max_crawl_pages: 100 },
    ]);
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

    return response.json();
  }
}
