import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync } from 'fs';
import { PageSpeedResult, PageSpeedMetrics } from '../../../shared/types';

// Pre-create a stable temp directory for Lighthouse to avoid EPERM on Windows
const LH_TMPDIR = join(tmpdir(), 'pulse-lighthouse');
try { mkdirSync(LH_TMPDIR, { recursive: true }); } catch { /* ignore */ }

const PSI_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PSI_TIMEOUT_MS = 30_000;
const LOCAL_TIMEOUT_MS = 60_000;
const OVERALL_TIMEOUT_MS = 90_000;

@Injectable()
export class PageSpeedService {
  private readonly logger = new Logger(PageSpeedService.name);
  private readonly apiKey: string;
  private readonly chromePath: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('PAGESPEED_API_KEY', '');
    this.chromePath = this.config.get<string>('CHROME_PATH', '');
  }

  async analyze(url: string): Promise<PageSpeedResult | null> {
    this.logger.log(`Running PageSpeed analysis for ${url}`);

    // Overall timeout so PageSpeed can never block the pipeline
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        this.logger.warn(`PageSpeed overall timeout (${OVERALL_TIMEOUT_MS}ms) for ${url}`);
        resolve(null);
      }, OVERALL_TIMEOUT_MS),
    );

    return Promise.race([this.analyzeInternal(url), timeout]);
  }

  private async analyzeInternal(url: string): Promise<PageSpeedResult | null> {
    // Attempt 1: PSI API
    try {
      const mobile = await this.runPsiStrategy(url, 'mobile');
      const desktop = await this.runPsiStrategy(url, 'desktop');
      this.logger.log(
        `PageSpeed (PSI) complete for ${url}: mobile=${mobile.performanceScore}, desktop=${desktop.performanceScore}`,
      );
      return { mobile, desktop };
    } catch (psiError) {
      this.logger.warn(`PSI API failed for ${url}: ${psiError}. Falling back to local Lighthouse.`);
    }

    // Attempt 2: Local Lighthouse
    try {
      const mobile = await this.runLocalStrategy(url, 'mobile');
      const desktop = await this.runLocalStrategy(url, 'desktop');
      this.logger.log(
        `PageSpeed (local) complete for ${url}: mobile=${mobile.performanceScore}, desktop=${desktop.performanceScore}`,
      );
      return { mobile, desktop };
    } catch (localError) {
      this.logger.error(`Both PSI and local Lighthouse failed for ${url}: ${localError}`);
      return null;
    }
  }

  // ── PSI API (remote) ────────────────────────────────────

  private async runPsiStrategy(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedMetrics> {
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
      signal: AbortSignal.timeout(PSI_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`PSI API returned ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as LighthouseJson;
    return this.extractMetrics(json);
  }

  // ── Local Lighthouse (headless Chrome) ──────────────────

  private async runLocalStrategy(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedMetrics> {
    // Dynamic imports: lighthouse v12+ is ESM-only
    const { default: lighthouse } = await import('lighthouse');
    const chromeLauncher = await import('chrome-launcher');

    // Override TEMP/TMP so os.tmpdir() (used by Lighthouse internally) points to our stable dir
    const origTemp = process.env.TEMP;
    const origTmp = process.env.TMP;
    process.env.TEMP = LH_TMPDIR;
    process.env.TMP = LH_TMPDIR;

    const chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        `--user-data-dir=${join(LH_TMPDIR, 'chrome-profile')}`,
      ],
      ...(this.chromePath ? { chromePath: this.chromePath } : {}),
    });

    try {
      const result = await lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        formFactor: strategy === 'mobile' ? 'mobile' : 'desktop',
        screenEmulation: strategy === 'mobile'
          ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
          : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        throttling: strategy === 'mobile'
          ? undefined // default mobile throttling
          : { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
        onlyCategories: ['performance', 'seo', 'accessibility'],
        maxWaitForLoad: LOCAL_TIMEOUT_MS,
      });

      if (!result?.lhr) {
        throw new Error('Lighthouse returned no result');
      }

      return this.extractMetrics({ lighthouseResult: result.lhr as LighthouseJson['lighthouseResult'] });
    } finally {
      try { await chrome.kill(); } catch (e) {
        // chrome-launcher's destroyTmp() calls rmSync which throws EPERM on Windows
        this.logger.warn(`Chrome cleanup warning (non-fatal): ${e}`);
      }
      // Restore original TEMP/TMP
      if (origTemp !== undefined) process.env.TEMP = origTemp;
      else delete process.env.TEMP;
      if (origTmp !== undefined) process.env.TMP = origTmp;
      else delete process.env.TMP;
    }
  }

  // ── Shared metric extraction ────────────────────────────

  private extractMetrics(json: LighthouseJson): PageSpeedMetrics {
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

interface LighthouseJson {
  lighthouseResult?: {
    categories?: Record<string, { score?: number }>;
    audits?: Record<string, { numericValue?: number }>;
  };
}
