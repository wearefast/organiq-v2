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
 * Consumers: LlmAuditService, and any future service that fetches or crawls external URLs.
 */
@Injectable()
export class WebCrawlerService {
  private readonly logger = new Logger(WebCrawlerService.name);

  // ─── High-level discovery ────────────────────────────────────

  /**
   * Full site discovery flow.
   *
   * 1. Validates `siteUrl` for SSRF safety.
   * 2. Fetches /robots.txt and /sitemap.xml from the same origin in parallel.
   * 3. Parses sitemap to return up to `limit` same-origin page URLs.
   * 4. Falls back to [siteUrl] if no usable sitemap is found.
   */
  async discoverSitePages(siteUrl: string, limit = 25): Promise<SiteDiscoveryResult> {
    await this.validateUrlSafety(siteUrl);

    const origin = new URL(siteUrl).origin;

    const [robotsTxt, sitemapXml] = await Promise.all([
      this.fetchText(`${origin}/robots.txt`),
      this.fetchText(`${origin}/sitemap.xml`),
    ]);

    const hadSitemap = !!sitemapXml && sitemapXml.includes('<loc>');
    const pageUrls = hadSitemap
      ? this.parseSitemapUrls(sitemapXml, origin, limit)
      : [siteUrl];

    this.logger.debug(
      `discoverSitePages: ${pageUrls.length} page(s) found on ${origin} (sitemap: ${hadSitemap})`,
    );

    return { origin, robotsTxt, sitemapXml, pageUrls, hadSitemap };
  }

  // ─── Sitemap parsing ─────────────────────────────────────────

  /**
   * Parse <loc> entries from a sitemap XML string.
   *
   * Filters to same-origin URLs only — rejects cross-origin entries a malicious
   * sitemap could inject to trigger server-side requests to internal hosts.
   */
  parseSitemapUrls(sitemapXml: string, origin: string, limit = 25): string[] {
    if (!sitemapXml || !sitemapXml.includes('<loc>')) return [];

    const $ = cheerio.load(sitemapXml, { xmlMode: true });
    const urls: string[] = [];

    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url && url.startsWith(origin)) urls.push(url);
    });

    return urls.slice(0, limit);
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
