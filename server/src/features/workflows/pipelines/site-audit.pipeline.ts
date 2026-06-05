import { Injectable, Logger } from '@nestjs/common';
import { FirecrawlService } from '../../integrations/firecrawl/firecrawl.service';
import { DataForSeoService } from '../../integrations/dataforseo/dataforseo.service';
import { PageSpeedService } from '../../integrations/pagespeed/pagespeed.service';
import type { Pipeline } from './pipeline.interface';

interface ShapedPage {
  url: string;
  title: string;
  description: string;
  /** First 3 000 chars of markdown — enough for headings, intro, and content signals without flooding the LLM context */
  markdown: string;
  wordCount: number;
}

interface ShapedPageSpeed {
  strategy: string;
  scores: { performance: number; seo: number; accessibility: number };
  cwv: {
    fcp: string | null;
    lcp: string | null;
    cls: string | null;
    tbt: string | null;
    si: string | null;
    lcpMs: number | null;
    clsValue: number | null;
    tbtMs: number | null;
  };
  topOpportunities: Array<{ id: string; title: string; score: number | null; displayValue: string | null }>;
}

@Injectable()
export class SiteAuditPipeline implements Pipeline {
  private readonly logger = new Logger(SiteAuditPipeline.name);
  readonly stepKey = 'site-audit';

  constructor(
    private readonly firecrawl: FirecrawlService,
    private readonly dataForSeo: DataForSeoService,
    private readonly pageSpeed: PageSpeedService,
  ) {}

  async execute(context: Record<string, unknown>): Promise<unknown> {
    const domain = context.domain as string;
    if (!domain) throw new Error('site-audit pipeline requires context.domain');

    const homepage = domain.startsWith('http') ? domain : `https://${domain}`;
    const origin = new URL(homepage).origin;
    const start = Date.now();
    const errors: string[] = [];

    this.logger.log(`site-audit pipeline: fetching data for ${domain}`);

    // All six API calls fire in parallel — Promise.allSettled so a single
    // failure (e.g. CrUX 403, PageSpeed 400) doesn't abort the whole run.
    const [
      siteMapResult,
      crawlResult,
      pagespeedMobileResult,
      pagespeedDesktopResult,
      cruxResult,
      onPageResult,
    ] = await Promise.allSettled([
      this.firecrawl.mapSite(origin),
      this.firecrawl.crawl(origin, 20),
      this.pageSpeed.analyze(homepage, 'mobile'),
      this.pageSpeed.analyze(homepage, 'desktop'),
      this.pageSpeed.getCruxData(origin),
      this.dataForSeo.createOnPageTask(origin),
    ]);

    const extract = <T>(result: PromiseSettledResult<T>, label: string): T | null => {
      if (result.status === 'fulfilled') return result.value;
      const msg = `${label}: ${(result.reason as Error)?.message ?? String(result.reason)}`;
      this.logger.warn(`site-audit pipeline error — ${msg}`);
      errors.push(msg);
      return null;
    };

    const rawSiteMap = extract(siteMapResult, 'firecrawl_map_site');
    const rawCrawl = extract(crawlResult, 'firecrawl_crawl');
    const rawPagespeedMobile = extract(pagespeedMobileResult, 'pagespeed_mobile');
    const rawPagespeedDesktop = extract(pagespeedDesktopResult, 'pagespeed_desktop');
    const rawCrux = extract(cruxResult, 'pagespeed_crux');
    const rawOnPage = extract(onPageResult, 'dataforseo_onpage');

    const crawledPages = this.shapeCrawledPages(rawCrawl);
    const pagespeedMobile = this.shapePageSpeed(rawPagespeedMobile, 'mobile');
    const pagespeedDesktop = this.shapePageSpeed(rawPagespeedDesktop, 'desktop');
    const onPageSummary = this.shapeOnPage(rawOnPage);

    const pagesDiscovered =
      (rawSiteMap as any)?.links?.length ??
      (rawSiteMap as any)?.urls?.length ??
      0;

    this.logger.log(
      `site-audit pipeline: done — ${crawledPages.length} pages crawled, ${errors.length} errors, ${Date.now() - start}ms`,
    );

    return {
      rawData: {
        siteMap: rawSiteMap,
        crawledPages,
        pagespeedMobile,
        pagespeedDesktop,
        crux: rawCrux,
        onPageSummary,
      },
      metadata: {
        domain,
        homepage,
        pagesDiscovered,
        pagesCrawled: crawledPages.length,
        apiCallCount: 6,
        durationMs: Date.now() - start,
        errors,
      },
    };
  }

  // ─── Shaping helpers ─────────────────────────────────────────────────────────

  private shapeCrawledPages(rawCrawl: unknown): ShapedPage[] {
    if (!rawCrawl || typeof rawCrawl !== 'object') return [];
    const data = (rawCrawl as any).data;
    if (!Array.isArray(data)) return [];

    return data.map((page: any) => {
      const markdown: string = typeof page.markdown === 'string' ? page.markdown : '';
      return {
        url: page.metadata?.url ?? page.url ?? '',
        title: page.metadata?.title ?? '',
        description: page.metadata?.description ?? '',
        markdown: markdown.slice(0, 3000),
        wordCount: markdown.split(/\s+/).filter(Boolean).length,
      };
    });
  }

  private shapePageSpeed(raw: unknown, strategy: string): ShapedPageSpeed | null {
    if (!raw || typeof raw !== 'object') return null;
    const lr = (raw as any).lighthouseResult;
    if (!lr) return null;

    const cats = lr.categories ?? {};
    const audits = lr.audits ?? {};
    const metrics = audits['metrics']?.details?.items?.[0] ?? {};

    const opportunities = (Object.entries(audits) as [string, any][])
      .filter(([, a]) => a.score !== null && a.score < 0.9 && a.details?.type === 'opportunity')
      .sort(([, a], [, b]) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 5)
      .map(([id, a]) => ({
        id,
        title: a.title as string,
        score: a.score as number | null,
        displayValue: (a.displayValue ?? null) as string | null,
      }));

    return {
      strategy,
      scores: {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      },
      cwv: {
        fcp: audits['first-contentful-paint']?.displayValue ?? null,
        lcp: audits['largest-contentful-paint']?.displayValue ?? null,
        cls: audits['cumulative-layout-shift']?.displayValue ?? null,
        tbt: audits['total-blocking-time']?.displayValue ?? null,
        si: audits['speed-index']?.displayValue ?? null,
        lcpMs: metrics.largestContentfulPaint ?? null,
        clsValue: metrics.cumulativeLayoutShift ?? null,
        tbtMs: metrics.totalBlockingTime ?? null,
      },
      topOpportunities: opportunities,
    };
  }

  private shapeOnPage(raw: unknown): Record<string, unknown> | null {
    if (!raw || typeof raw !== 'object') return null;
    const tasks = (raw as any).tasks;
    if (!Array.isArray(tasks) || !tasks[0]?.result?.[0]) return null;

    // Return the aggregate summary only — omit per-URL page arrays to keep context lean
    const result = { ...(tasks[0].result[0] as Record<string, unknown>) };
    delete result['pages'];
    delete result['page_metrics'];
    return result;
  }
}
