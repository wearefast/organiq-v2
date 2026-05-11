import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Strategy = 'mobile' | 'desktop';

@Injectable()
export class PageSpeedService {
  private readonly logger = new Logger(PageSpeedService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PAGESPEED_API_KEY', '');
  }

  async analyze(url: string, strategy: Strategy = 'mobile'): Promise<unknown> {
    const params = new URLSearchParams({
      url,
      strategy,
      category: 'performance',
      ...(this.apiKey ? { key: this.apiKey } : {}),
    });

    this.logger.debug(`PageSpeed API: ${url} (${strategy})`);

    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
      { signal: AbortSignal.timeout(60_000) },
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`PageSpeed API error: ${response.status}`);
      throw new Error(`PageSpeed API error: ${response.status}`);
    }

    return response.json();
  }

  async getCruxData(origin: string): Promise<unknown> {
    if (!this.apiKey) throw new Error('PAGESPEED_API_KEY is not configured for CrUX');

    this.logger.debug(`CrUX API: ${origin}`);

    const response = await fetch(
      `https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`CrUX API error: ${response.status}`);
      throw new Error(`CrUX API error: ${response.status}`);
    }

    return response.json();
  }
}
