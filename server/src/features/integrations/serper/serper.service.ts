import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SearchType = 'search' | 'news' | 'images' | 'places';

interface SearchOptions {
  query: string;
  country?: string;
  location?: string;
  num?: number;
  type?: SearchType;
}

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://google.serper.dev';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('SERPER_API_KEY', '');
  }

  async search(options: SearchOptions): Promise<unknown> {
    const type = options.type ?? 'search';
    return this.post(`/${type}`, {
      q: options.query,
      gl: options.country ?? 'us',
      location: options.location,
      num: options.num ?? 10,
    });
  }

  async searchBatch(queries: string[], country: string = 'us'): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const query of queries) {
      const result = await this.search({ query, country });
      results.push(result);
    }
    return results;
  }

  private async post(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.apiKey) throw new Error('SERPER_API_KEY is not configured');

    this.logger.debug(`Serper API: POST ${endpoint} (q=${body.q})`);

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Serper API error: ${response.status}`);
      throw new Error(`Serper API error: ${response.status}`);
    }

    return response.json();
  }
}
