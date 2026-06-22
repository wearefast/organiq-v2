import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '../../../shared/utils/retry';
import { ApiUsageContextService } from '../../api-usage/api-usage-context.service';
import { ApiUsageService } from '../../api-usage/api-usage.service';
import { firecrawlCostUsd } from '../../api-usage/pricing.constants';

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

  constructor(
    private readonly config: ConfigService,
    private readonly apiUsageContext: ApiUsageContextService,
    private readonly apiUsageService: ApiUsageService,
  ) {
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
    // Submit the async crawl job
    const submission = await this.post('/crawl', {
      url,
      limit,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }) as { id?: string; success?: boolean };

    const crawlId = submission?.id;
    if (!crawlId) {
      throw new Error('Firecrawl crawl submission did not return a job ID');
    }

    this.logger.log(`Firecrawl crawl job submitted: ${crawlId}, polling for completion...`);

    // Poll until status === 'completed' (max 3 minutes, 10-second intervals)
    const maxWaitMs = 3 * 60 * 1000;
    const pollIntervalMs = 10_000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise<void>(resolve => setTimeout(resolve, pollIntervalMs));

      const status = await this.get(`/crawl/${crawlId}`) as { status?: string; data?: unknown };
      this.logger.debug(`Firecrawl crawl ${crawlId}: status=${status?.status}`);

      if (status?.status === 'completed') {
        return status;
      }
      if (status?.status === 'failed') {
        throw new Error(`Firecrawl crawl job failed: ${crawlId}`);
      }
      // status === 'scraping' — continue polling
    }

    throw new Error(`Firecrawl crawl timed out after 3 minutes: ${crawlId}`);
  }

  async getCrawlStatus(crawlId: string): Promise<unknown> {
    return this.get(`/crawl/${crawlId}`);
  }

  async mapSite(url: string): Promise<unknown> {
    return this.post('/map', { url });
  }

  private async post(endpoint: string, body: unknown): Promise<unknown> {
    if (!this.apiKey) throw new Error('FIRECRAWL_API_KEY is not configured');

    // Include the target URL in the log for traceability
    const targetUrl = (body as Record<string, unknown>)?.url ?? '';
    this.logger.log(`Firecrawl → POST ${endpoint}${targetUrl ? ` url="${String(targetUrl).slice(0, 100)}"` : ''}`);
    const reqStart = Date.now();

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

        const durationMs = Date.now() - reqStart;

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(
            `Firecrawl ✗ POST ${endpoint} status=${response.status} duration=${durationMs}ms body=${text.slice(0, 300)}`,
          );
          throw new Error(`Firecrawl API error: ${response.status}`);
        }

        this.logger.log(`Firecrawl ✓ POST ${endpoint} duration=${durationMs}ms`);

        // Record API usage — fire-and-forget
        const ctx = this.apiUsageContext.getContext();
        if (ctx) {
          this.apiUsageService.record({
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            workflowRunId: ctx.workflowRunId,
            stepKey: ctx.stepKey,
            provider: 'firecrawl',
            endpoint,
            costUsd: firecrawlCostUsd(endpoint),
            durationMs,
            success: true,
          });
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
        const reqStart = Date.now();
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: AbortSignal.timeout(30_000),
        });

        const durationMs = Date.now() - reqStart;

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(
            `Firecrawl ✗ GET ${endpoint} status=${response.status} duration=${durationMs}ms body=${text.slice(0, 300)}`,
          );
          throw new Error(`Firecrawl API error: ${response.status}`);
        }

        return response.json();
      },
      { label: `Firecrawl GET ${endpoint}` },
    );
  }
}
