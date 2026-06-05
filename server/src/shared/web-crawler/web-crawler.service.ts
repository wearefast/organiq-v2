import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import * as cheerio from 'cheerio';

// ─── Public types ─────────────────────────────────────────────

export interface SiteDiscoveryResult {
  /** Origin URL (e.g. https://example.com) */
  origin: string;
  /** Raw text of /robots.txt, or '' if unreachable */
  robotsTxt: string;
  /** Raw XML of /sitemap.xml, or '' if unreachable */
  sitemapXml: string;
  /** Pages discovered from sitemap, filtered to same-origin, capped at `limit` */
  pageUrls: string[];
  /** True when sitemap.xml was present and parseable */
  hadSitemap: boolean;
}

/**
 * Shared utility for SSRF-safe external web fetching and sitemap-driven site discovery.
 *
 * Registered as @Global() — inject WebCrawlerService in any feature service without
 * importing WebCrawlerModule explicitly.
 *
 * Consumers: LlmAuditService, BusinessProfileService, ProjectsService, and any future
 * service that fetches or crawls external URLs.
 */
@Injectable()
export class WebCrawlerService {
  private readonly logger = new Logger(WebCrawlerService.name);

  /** Country code (ISO 3166-1 alpha-2 lowercase) → common URL path segment aliases */
  private static readonly COUNTRY_ALIASES: Record<string, string[]> = {
    ae: ['uae', 'ae'],
    us: ['us', 'usa'],
    gb: ['uk', 'gb'],
    sa: ['sa', 'ksa', 'saudi'],
    eg: ['eg', 'egypt'],
    in: ['in', 'india'],
    au: ['au', 'australia'],
    ca: ['ca', 'canada'],
    de: ['de', 'germany'],
    fr: ['fr', 'france'],
  };

  // ─── High-level discovery ────────────────────────────────────

  /**
   * Full site discovery flow.
   *
   * 1. Validates `siteUrl` for SSRF safety.
   * 2. Fetches /robots.txt and /sitemap.xml in parallel.
   * 3. Reads robots.txt for a Sitemap: directive — uses that URL if /sitemap.xml is empty.
   * 4. Detects sitemap index files (<sitemapindex>) and resolves them to actual page URLs:
   *    - Scores child sitemaps against optional country/language hints (e.g. uae/en).
   *    - Fetches the best-scoring child sitemap, or merges all if no locale match.
   * 5. Falls back to [siteUrl] if no usable sitemap is found at all.
   *
   * @param hints  Optional project locale — ISO 3166-1 alpha-2 country (e.g. "AE") and
   *               BCP 47 base language tag (e.g. "en") used to score sitemap index entries.
   */
  async discoverSitePages(
    siteUrl: string,
    limit = 25,
    hints?: { country?: string; language?: string },
  ): Promise<SiteDiscoveryResult> {
    await this.validateUrlSafety(siteUrl);

    const origin = new URL(siteUrl).origin;

    // Fetch robots.txt + standard /sitemap.xml in parallel
    const [robotsTxt, rootSitemapXml] = await Promise.all([
      this.fetchText(`${origin}/robots.txt`),
      this.fetchText(`${origin}/sitemap.xml`),
    ]);

    // ── Step 1: resolve canonical sitemap URL ─────────────────────────────
    // If /sitemap.xml returned nothing, check robots.txt Sitemap: directive for
    // a non-standard sitemap path (e.g. /sitemap_index.xml, /en/sitemap.xml).
    let sitemapXml = rootSitemapXml;
    if (!sitemapXml) {
      const robotsUrls = this.extractRobotsSitemapUrls(robotsTxt, origin);
      const alternate = robotsUrls.find((u) => u !== `${origin}/sitemap.xml`);
      if (alternate) {
        this.logger.debug(`robots.txt sitemap directive points to ${alternate}`);
        sitemapXml = await this.fetchText(alternate);
      }
    }

    // ── Step 2: handle sitemap index ─────────────────────────────────────
    // A sitemap index contains <sitemapindex><sitemap><loc>…</loc></sitemap>
    // entries pointing to child sitemaps — NOT page URLs. We must resolve those.
    if (sitemapXml && this.isSitemapIndex(sitemapXml)) {
      const childUrls = this.parseSitemapIndexLocations(sitemapXml, origin);
      this.logger.debug(`Sitemap index: ${childUrls.length} child sitemaps on ${origin}`);

      if (childUrls.length > 0) {
        if (hints?.country || hints?.language) {
          const scored = childUrls
            .map((url) => ({ url, score: this.scoreSitemapForHints(url, hints) }))
            .sort((a, b) => b.score - a.score);

          if (scored[0].score > 0) {
            // Clear locale match — fetch just that child sitemap
            this.logger.debug(
              `Best child sitemap: ${scored[0].url} (score ${scored[0].score})`,
            );
            sitemapXml = await this.fetchText(scored[0].url);
          } else {
            // No locale match — merge page URLs from all child sitemaps (cap at 5 fetches)
            const xmls = await Promise.all(childUrls.slice(0, 5).map((u) => this.fetchText(u)));
            const merged: string[] = [];
            for (const xml of xmls) {
              merged.push(...this.parseSitemapUrls(xml, origin, limit));
              if (merged.length >= limit) break;
            }
            const pageUrls = merged.slice(0, limit);
            this.logger.debug(
              `discoverSitePages: ${pageUrls.length} pages merged from index on ${origin}`,
            );
            return { origin, robotsTxt, sitemapXml, pageUrls, hadSitemap: true };
          }
        } else {
          // No hints — use first child sitemap
          sitemapXml = await this.fetchText(childUrls[0]);
        }
      }
    }

    // ── Step 3: extract page URLs from the resolved sitemap ───────────────
    const hadSitemap = !!sitemapXml && sitemapXml.includes('<loc>');
    const pageUrls = hadSitemap
      ? this.parseSitemapUrls(sitemapXml, origin, limit)
      : [siteUrl];

    this.logger.debug(
      `discoverSitePages: ${pageUrls.length} page(s) on ${origin} (hadSitemap: ${hadSitemap})`,
    );

    return { origin, robotsTxt, sitemapXml: sitemapXml ?? '', pageUrls, hadSitemap };
  }

  // ─── Sitemap parsing ─────────────────────────────────────────

  /**
   * Parse <loc> entries from a page sitemap (<urlset>).
   *
   * Filters to same-origin URLs only — rejects cross-origin entries a malicious
   * sitemap could inject to trigger server-side requests to internal hosts.
   * NOTE: use parseSitemapIndexLocations() for sitemap index files.
   */
  parseSitemapUrls(sitemapXml: string, origin: string, limit = 25): string[] {
    if (!sitemapXml || !sitemapXml.includes('<loc>')) return [];

    const $ = cheerio.load(sitemapXml, { xmlMode: true });
    const urls: string[] = [];

    $('url > loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url && this.isSameEffectiveDomain(url, origin)) urls.push(url);
    });

    return urls.slice(0, limit);
  }

  /** Extract Sitemap: directive URLs from robots.txt, filtered to same-origin only. */
  private extractRobotsSitemapUrls(robotsTxt: string, origin: string): string[] {
    return robotsTxt
      .split('\n')
      .filter((line) => line.trim().toLowerCase().startsWith('sitemap:'))
      .map((line) => line.slice(line.indexOf(':') + 1).trim())
      .filter((url) => url.startsWith('http') && url.startsWith(origin));
  }

  /** True when the XML is a sitemap index (list of sub-sitemaps) not a page <urlset>. */
  private isSitemapIndex(xml: string): boolean {
    return xml.includes('<sitemapindex');
  }

  /**
   * Extract child <sitemap><loc> entries from a sitemap index.
   * Uses 'sitemap > loc' selector — NOT bare 'loc' which also matches page <urlset> entries.
   * Same-origin filter applied for SSRF safety.
   */
  private parseSitemapIndexLocations(xml: string, origin: string): string[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const urls: string[] = [];
    $('sitemap > loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url && this.isSameEffectiveDomain(url, origin)) urls.push(url);
    });
    return urls;
  }

  /**
   * Score a child sitemap URL by how well its path segments match the project's
   * country (ISO 3166-1 alpha-2) and language (BCP 47 base tag).
   * Higher is better; 0 means no match.
   *
   * Examples for country=AE, language=en:
   *   sitemaps/uae/en/sitemap.xml → 5 (uae=3, en=2)
   *   sitemaps/uae/ar/sitemap.xml → 3 (uae=3)
   *   sitemaps/uk/en/sitemap.xml  → 2 (en=2)
   */
  private scoreSitemapForHints(
    url: string,
    hints: { country?: string; language?: string },
  ): number {
    const lower = url.toLowerCase();
    // Match on path segment boundaries: /uae/, -uae/, _uae., etc.
    const seg = (s: string) => new RegExp(`[/\\-_.]${s}[/\\-_.]`).test(lower);
    let score = 0;
    if (hints.country) {
      const aliases =
        WebCrawlerService.COUNTRY_ALIASES[hints.country.toLowerCase()] ??
        [hints.country.toLowerCase()];
      if (aliases.some((a) => seg(a))) score += 3;
    }
    if (hints.language) {
      const lang = hints.language.toLowerCase().split('-')[0]; // 'en-AE' → 'en'
      if (seg(lang)) score += 2;
    }
    return score;
  }

  /**
   * True when two URLs share the same effective domain, treating www as equivalent
   * to the bare domain (e.g. mashreq.com ↔ www.mashreq.com).
   * Used to keep same-site sitemap entries while rejecting genuinely cross-origin ones.
   */
  private isSameEffectiveDomain(url: string, origin: string): boolean {
    try {
      const strip = (h: string) => h.replace(/^www\./, '').toLowerCase();
      return strip(new URL(url).hostname) === strip(new URL(origin).hostname);
    } catch {
      return false;
    }
  }

  // ─── HTTP fetch ──────────────────────────────────────────────

  /**
   * Fetch the text content of a URL with a configurable timeout.
   * Returns '' on any failure so callers can decide how to handle a missing resource.
   *
   * Does NOT perform SSRF validation — call validateUrlSafety() first when the URL
   * comes from user input.
   */
  async fetchText(url: string, timeoutMs = 10_000): Promise<string> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PulseBot/1.0 (+https://getpulse.ai/bot)' },
      });
      clearTimeout(timer);
      if (!response.ok) return '';
      return await response.text();
    } catch {
      this.logger.warn(`fetchText failed for ${url}`);
      return '';
    }
  }

  // ─── SSRF protection ─────────────────────────────────────────

  /**
   * Validate that a URL is safe to fetch.
   *
   * Checks:
   * - Protocol must be http: or https:
   * - Hostname must not be a known internal host (localhost, 127.0.0.1, etc.)
   * - Resolved IP must not be in RFC-1918 / link-local / loopback ranges
   *
   * Throws BadRequestException (NestJS 400) if the URL fails any check.
   */
  async validateUrlSafety(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only HTTP/HTTPS URLs are allowed');
    }

    const hostname = parsed.hostname.toLowerCase();
    const blockedHostnames = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '[::1]',
      'metadata.google.internal',
    ];
    if (blockedHostnames.includes(hostname)) {
      throw new BadRequestException('Internal URLs are not allowed');
    }

    try {
      const { address } = await lookup(hostname);
      if (this.isPrivateIp(address)) {
        throw new BadRequestException('URLs resolving to private IP ranges are not allowed');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException(`Cannot resolve hostname: ${hostname}`);
    }
  }

  // ─── Private helpers ─────────────────────────────────────────

  private isPrivateIp(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true; // IPv6 or malformed — block by default
    if (parts[0] === 10) return true;                                      // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true;                 // 192.168.0.0/16
    if (parts[0] === 127) return true;                                     // 127.0.0.0/8
    if (parts[0] === 169 && parts[1] === 254) return true;                 // 169.254.0.0/16 (link-local / AWS metadata)
    if (parts[0] === 0) return true;                                       // 0.0.0.0/8
    return false;
  }
}
