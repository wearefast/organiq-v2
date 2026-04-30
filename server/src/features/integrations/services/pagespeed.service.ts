import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PageSpeedResult, PageSpeedMetrics } from '../../../shared/types';

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const FETCH_TIMEOUT_MS = 30_000;

@Injectable()
export class PageSpeedService {
  private readonly logger = new Logger(PageSpeedService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PAGESPEED_API_KEY', '');
  }

  async analyze(url: string): Promise<PageSpeedResult | null> {
    this.logger.log(`Running PageSpeed analysis for ${url}`);

    try {
      const mobile = await this.runStrategy(url, 'mobile');
      const desktop = await this.runStrategy(url, 'desktop');
      this.logger.log(
        `PageSpeed complete for ${url}: mobile perf=${mobile.performanceScore}, desktop perf=${desktop.performanceScore}`,
      );
      return { mobile, desktop };
    } catch (error) {
      this.logger.error(`PageSpeed analysis failed for ${url}: ${error}`);
      return null;
    }
  }

  private async runStrategy(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedMetrics> {
    const params = new URLSearchParams({
      url,
      strategy,
      category: 'performance',
    });
    params.append('category', 'seo');
    params.append('category', 'accessibility');

    if (this.apiKey) {
      params.set('key', this.apiKey);
    }

    const response = await fetch(`${PSI_API_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`PSI API returned ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number }>;
      };
    };
    const categories = json.lighthouseResult?.categories ?? {};
    const audits = json.lighthouseResult?.audits ?? {};

    return {
      performanceScore: Math.round((categories.performance?.score ?? 0) * 100),
      seoScore: Math.round((categories.seo?.score ?? 0) * 100),
      accessibilityScore: Math.round((categories.accessibility?.score ?? 0) * 100),
      lcp: Math.round(audits['largest-contentful-paint']?.numericValue ?? 0),
      cls: parseFloat((audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
      fid: Math.round(audits['total-blocking-time']?.numericValue ?? 0),
    };
  }
}
