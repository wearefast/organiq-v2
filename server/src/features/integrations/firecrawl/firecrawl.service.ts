import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '../../../shared/utils/retry';

interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  waitFor?: number;
}

@Injectable()
export class FirecrawlService {
  private readonly logger = new Logger(FirecrawlService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.firecrawl.dev/v1';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FIRECRAWL_API_KEY', '');
  }

  async scrape(url: string, options?: ScrapeOptions): Promise<unknown> {
    return this.post('/scrape', {
      url,
      formats: options?.formats ?? ['markdown'],
      onlyMainContent: options?.onlyMainContent ?? true,
      waitFor: options?.waitFor ?? 0,
    });
  }

  async crawl(url: string, limit: number = 50): Promise<unknown> {
    return this.post('/crawl', {
      url,
      limit,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    });
  }

  async getCrawlStatus(crawlId: string): Promise<unknown> {
    return this.get(`/crawl/${crawlId}`);
  }

  async mapSite(url: string): Promise<unknown> {
    return this.post('/map', { url });
  }

  private async post(endpoint: string, body: unknown): Promise<unknown> {
    if (!this.apiKey) throw new Error('FIRECRAWL_API_KEY is not configured');

    this.logger.debug(`Firecrawl API: POST ${endpoint}`);

    return withRetry(
      async () => {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(`Firecrawl API error: ${response.status}`);
          throw new Error(`Firecrawl API error: ${response.status}`);
        }

        return response.json();
      },
      { label: `Firecrawl POST ${endpoint}` },
    );
  }

  private async get(endpoint: string): Promise<unknown> {
    if (!this.apiKey) throw new Error('FIRECRAWL_API_KEY is not configured');

    return withRetry(
      async () => {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(`Firecrawl API error: ${response.status}`);
          throw new Error(`Firecrawl API error: ${response.status}`);
        }

        return response.json();
      },
      { label: `Firecrawl GET ${endpoint}` },
    );
  }
}
