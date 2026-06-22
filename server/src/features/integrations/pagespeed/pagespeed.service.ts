import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { withRetry } from '../../../shared/utils/retry';
import { ApiUsageContextService } from '../../api-usage/api-usage-context.service';
import { ApiUsageService } from '../../api-usage/api-usage.service';

type Strategy = 'mobile' | 'desktop';

@Injectable()
export class PageSpeedService {
  private readonly logger = new Logger(PageSpeedService.name);
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly apiUsageContext: ApiUsageContextService,
    private readonly apiUsageService: ApiUsageService,
  ) {
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

    return withRetry(
      async () => {
        const response = await fetch(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
          { signal: AbortSignal.timeout(60_000) },
        );

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(`PageSpeed API error: ${response.status}`);
          throw new Error(`PageSpeed API error: ${response.status}`);
        }

        const data = await response.json();

        // Record API usage — fire-and-forget ($0 cost, free tier)
        const ctx = this.apiUsageContext.getContext();
        if (ctx) {
          this.apiUsageService.record({
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            workflowRunId: ctx.workflowRunId,
            stepKey: ctx.stepKey,
            provider: 'pagespeed',
            endpoint: '/pagespeedonline',
            costUsd: 0,
            success: true,
          });
        }

        return data;
      },
      { label: `PageSpeed ${url}` },
    );
  }

  async getCruxData(origin: string): Promise<unknown> {
    if (!this.apiKey) {
      this.logger.warn('PAGESPEED_API_KEY is not configured — CrUX field data unavailable, falling back to lab data only');
      return null;
    }

    this.logger.debug(`CrUX API: ${origin}`);

    return withRetry(
      async () => {
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
      },
      { label: `CrUX ${origin}` },
    );
  }
}
