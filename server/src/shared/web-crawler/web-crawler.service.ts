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
    qa: ['qa', 'qatar'],
    kw: ['kw', 'kuwait'],
    bh: ['bh', 'bahrain'],
    om: ['om', 'oman'],
    jo: ['jo', 'jordan'],
    lb: ['lb', 'lebanon'],
    sg: ['sg', 'singapore'],
    nz: ['nz', 'newzealand'],
    za: ['za', 'southafrica'],
    ng: ['ng', 'nigeria'],
    ke: ['ke', 'kenya'],
    mx: ['mx', 'mexico'],
    br: ['br', 'brazil'],
    ar: ['ar', 'argentina'],
    jp: ['jp', 'japan'],
    cn: ['cn', 'china'],
    kr: ['kr', 'korea'],
    my: ['my', 'malaysia'],
    id: ['id', 'indonesia'],
    th: ['th', 'thailand'],
    vn: ['vn', 'vietnam'],
    pk: ['pk', 'pakistan'],
    bd: ['bd', 'bangladesh'],
    lk: ['lk', 'srilanka'],
    gh: ['gh', 'ghana'],
    tz: ['tz', 'tanzania'],
    ug: ['ug', 'uganda'],
    et: ['et', 'ethiopia'],
    ma: ['ma', 'morocco'],
    dz: ['dz', 'algeria'],
    tn: ['tn', 'tunisia'],
    hk: ['hk', 'hongkong'],
  };

  // ─── High-level discovery ────────────────────────────────────

  /**
   * Full site discovery flow — locale-aware, probe-first strategy.
   *
   * Strategy (in priority order):
   * 1. Validates `siteUrl` for SSRF safety.
   * 2. Fetches robots.txt to extract Sitemap: directives.
   * 3. Builds an ordered probe list:
   *    - Locale-specific paths first (e.g. /en-ae/sitemap.xml, /uae/sitemap.xml)
   *    - Then robots.txt declared sitemaps
   *    - Then standard locations (/sitemap.xml, /sitemap_index.xml, …)
   * 4. Iterates probe list: first probe that yields page URLs wins.
   *    - Sitemap index files are resolved via locale-scored child selection.
   * 5. Falls back to [siteUrl] if no usable sitemap is found at all.
   *
   * @param hints  Optional project locale — ISO 3166-1 alpha-2 country (e.g. "AE") and
   *               BCP 47 base language tag (e.g. "en") used for locale-specific probing
   *               and scoring sitemap index entries.
   */
  async discoverSitePages(
    siteUrl: string,
    limit = 25,
    hints?: { country?: string; language?: string },
  ): Promise<SiteDiscoveryResult> {
    await this.validateUrlSafety(siteUrl);

    const origin = new URL(siteUrl).origin;

    // Fetch robots.txt — we need this before building the probe list
    const robotsTxt = await this.fetchText(`${origin}/robots.txt`);
    const robotsSitemapUrls = this.extractRobotsSitemapUrls(robotsTxt, origin);

    // Build ordered probe list: locale-specific paths first → robots.txt → standard
    const probeList = this.buildSitemapProbeList(origin, robotsSitemapUrls, hints);

    let lastXml = '';

    for (const probeUrl of probeList) {
      const xml = await this.fetchText(probeUrl);
      if (!xml) continue;
      lastXml = xml;

      // Case A: sitemap index — resolve to actual page URLs via locale scoring
      if (this.isSitemapIndex(xml)) {
        const pageUrls = await this.resolveFromSitemapIndex(xml, origin, hints, limit);
        if (pageUrls.length > 0) {
          this.logger.log(
            `discoverSitePages: ${pageUrls.length} pages via sitemap index at ${probeUrl}`,
          );
          return { origin, robotsTxt, sitemapXml: xml, pageUrls, hadSitemap: true };
        }
        // Index had entries but resolved to 0 usable pages — try next probe
        continue;
      }

      // Case B: direct page sitemap
      if (xml.includes('<loc>')) {
        let pageUrls = this.parseSitemapUrls(xml, origin, limit * 4); // over-fetch to allow filtering
        // Post-filter by locale when hints are provided
        pageUrls = this.filterUrlsByLocale(pageUrls, hints, limit);
        if (pageUrls.length > 0) {
          this.logger.log(`discoverSitePages: ${pageUrls.length} pages from ${probeUrl}`);
          return { origin, robotsTxt, sitemapXml: xml, pageUrls, hadSitemap: true };
        }
      }
    }

    // Fallback: no usable sitemap found
    this.logger.warn(
      `discoverSitePages: no usable sitemap found for ${origin} — falling back to root URL`,
    );
    return { origin, robotsTxt, sitemapXml: lastXml, pageUrls: [siteUrl], hadSitemap: false };
  }

  /**
   * Build an ordered list of sitemap URLs to probe for the given origin and hints.
   *
   * Order (highest priority first):
   *   1. Enterprise sub-directory patterns — e.g. /sitemaps/{country}/{lang}/sitemap.xml
   *      This handles sites like Mashreq whose sitemap index uses /sitemaps/uae/en/.
   *   2. Flat locale paths — e.g. /en-ae/sitemap.xml, /{country}/{lang}/sitemap.xml
   *   3. robots.txt declared sitemaps
   *   4. Standard well-known locations (/sitemap.xml, /sitemap_index.xml, …)
   */
  private buildSitemapProbeList(
    origin: string,
    robotsSitemapUrls: string[],
    hints?: { country?: string; language?: string },
  ): string[] {
    const probes: string[] = [];

    if (hints?.country && hints?.language) {
      const country = hints.country.toLowerCase();
      const lang = hints.language.toLowerCase().split('-')[0]; // 'en-AE' → 'en'
      const aliases = WebCrawlerService.COUNTRY_ALIASES[country] ?? [country];

      for (const alias of aliases) {
        // ── Tier 1: enterprise sub-directory convention (e.g. Mashreq: /sitemaps/uae/en/) ─
        probes.push(
          `${origin}/sitemaps/${alias}/${lang}/sitemap.xml`,
          `${origin}/sitemap/${alias}/${lang}/sitemap.xml`,
          `${origin}/sitemaps/${lang}/${alias}/sitemap.xml`,
          `${origin}/sitemap/${lang}/${alias}/sitemap.xml`,
        );

        // ── Tier 2: flat locale paths ──────────────────────────────────────────────────
        probes.push(
          // BCP 47 combined locale: /en-ae/sitemap.xml
          `${origin}/${lang}-${alias}/sitemap.xml`,
          `${origin}/${lang}_${alias}/sitemap.xml`,
          // country/lang segments: /ae/en/sitemap.xml
          `${origin}/${alias}/${lang}/sitemap.xml`,
          // named files: /sitemap-en-ae.xml
          `${origin}/sitemap-${lang}-${alias}.xml`,
          `${origin}/sitemap_${lang}_${alias}.xml`,
        );
      }
      // Language-only path (e.g. /en/sitemap.xml)
      probes.push(`${origin}/${lang}/sitemap.xml`);
    } else if (hints?.country) {
      const country = hints.country.toLowerCase();
      const aliases = WebCrawlerService.COUNTRY_ALIASES[country] ?? [country];
      for (const alias of aliases) {
        probes.push(
          `${origin}/sitemaps/${alias}/sitemap.xml`,
          `${origin}/sitemap/${alias}/sitemap.xml`,
          `${origin}/${alias}/sitemap.xml`,
          `${origin}/sitemap-${alias}.xml`,
        );
      }
    }

    // Robots.txt declared sitemaps (already same-effective-domain filtered)
    probes.push(...robotsSitemapUrls);

    // Standard well-known locations (tried after locale-specific probes)
    probes.push(
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
      `${origin}/sitemaps/sitemap.xml`,
    );

    // Deduplicate while preserving order
    return [...new Set(probes)];
  }

  /**
   * Given a sitemap index XML, select the best child sitemaps based on locale hints
   * and return merged page URLs.
   *
   * Key behaviour:
   * - With hints: finds the top score, then fetches ALL children at that same score
   *   in parallel. This handles sites like Mashreq where uae/en + uae/ar both score
   *   equally for country=AE — both are merged for full market page coverage.
   * - Score 0 across all: merges the first 5 children (no locale signal available).
   * - Without hints: uses the first child sitemap (legacy behaviour).
   */
  private async resolveFromSitemapIndex(
    indexXml: string,
    origin: string,
    hints: { country?: string; language?: string } | undefined,
    limit: number,
  ): Promise<string[]> {
    const childUrls = this.parseSitemapIndexLocations(indexXml, origin);
    if (childUrls.length === 0) return [];

    this.logger.debug(`Sitemap index: ${childUrls.length} child sitemaps on ${origin}`);

    if (hints?.country || hints?.language) {
      const scored = childUrls
        .map((url) => ({ url, score: this.scoreSitemapForHints(url, hints) }))
        .sort((a, b) => b.score - a.score);

      const topScore = scored[0].score;

      if (topScore > 0) {
        // Fetch ALL children tied at the top score — e.g. uae/en + uae/ar for country=AE
        const topMatches = scored.filter((s) => s.score === topScore).map((s) => s.url);
        this.logger.debug(
          `Best child sitemaps (score ${topScore}): ${topMatches.join(', ')}`,
        );
        const xmls = await Promise.all(topMatches.map((u) => this.fetchText(u)));
        const merged: string[] = [];
        for (const xml of xmls) {
          merged.push(...this.parseSitemapUrls(xml, origin, limit));
          if (merged.length >= limit) break;
        }
        return merged.slice(0, limit);
      }

      // No locale match in index — merge pages from first N child sitemaps
      this.logger.debug(
        `No locale match in sitemap index for ${origin} — merging child sitemaps`,
      );
      const xmls = await Promise.all(childUrls.slice(0, 5).map((u) => this.fetchText(u)));
      const merged: string[] = [];
      for (const xml of xmls) {
        merged.push(...this.parseSitemapUrls(xml, origin, limit));
        if (merged.length >= limit) break;
      }
      return merged.slice(0, limit);
    }

    // No hints — use first child sitemap
    const xml = await this.fetchText(childUrls[0]);
    return this.parseSitemapUrls(xml, origin, limit);
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

  /**
   * Extract Sitemap: directive URLs from robots.txt.
   * Filters to same-effective-domain only (www.example.com treated as example.com)
   * for SSRF safety while handling www-prefixed sitemap declarations.
   */
  private extractRobotsSitemapUrls(robotsTxt: string, origin: string): string[] {
    return robotsTxt
      .split('\n')
      .filter((line) => line.trim().toLowerCase().startsWith('sitemap:'))
      .map((line) => line.slice(line.indexOf(':') + 1).trim())
      .filter((url) => url.startsWith('http') && this.isSameEffectiveDomain(url, origin));
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
   * Matching rules:
   * - Segment must be bounded by path delimiters (/, -, _, .) on the left AND
   *   either a delimiter or end-of-string on the right.
   * - Combined BCP-47 locale tags (e.g. 'en-ae') score both country (3) + language (2) = 5.
   *
   * Examples for country=AE, language=en:
   *   /en-ae/sitemap.xml    → 5 (ae=3, en=2)
   *   /uae/en/sitemap.xml   → 5 (uae=3, en=2)
   *   /ar-ae/sitemap.xml    → 3 (ae=3)
   *   /en-gb/sitemap.xml    → 2 (en=2)
   *   /sitemap-us.xml       → 0
   */
  private scoreSitemapForHints(
    url: string,
    hints: { country?: string; language?: string },
  ): number {
    const lower = url.toLowerCase();
    // Segment boundary: delimiter on left, delimiter OR end-of-string on right
    const seg = (s: string) =>
      new RegExp(`[/\\-_.]${s}([/\\-_.]|$)`).test(lower);
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

  /**
   * Filter page URLs by locale hints (country + language).
   *
   * When a sitemap has URLs for multiple locales (e.g. /ae, /ae-ar, /sa-en, /eg),
   * this method scores each URL and returns only those matching the project locale.
   * If no locale-matched URLs exist (non-localized site), returns the first `limit`.
   *
   * Scoring: uses the same segment matching as scoreSitemapForHints but on page URLs.
   * For country=AE + language=en, /ae matches (country), /ae-ar doesn't (has Arabic
   * segment but no English), /ae/coupons matches.
   *
   * Special rule for combined locale segments: if a URL contains a combined segment
   * like /ae-ar or /sa-en, both parts contribute. A URL with /ae-ar scores 3 (country)
   * but NOT language. A URL with /ae alone (no conflicting language marker) is treated
   * as matching both country + the default language.
   */
  private filterUrlsByLocale(
    urls: string[],
    hints: { country?: string; language?: string } | undefined,
    limit: number,
  ): string[] {
    if (!hints?.country && !hints?.language) return urls.slice(0, limit);
    if (urls.length === 0) return [];

    const country = hints.country?.toLowerCase();
    const lang = hints.language?.toLowerCase().split('-')[0]; // 'en-AE' → 'en'
    const countryAliases = country
      ? WebCrawlerService.COUNTRY_ALIASES[country] ?? [country]
      : [];

    // All known language codes that appear in locale path segments
    const otherLangs = ['ar', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'ja', 'ko', 'zh', 'hi', 'ur', 'tr'];
    const otherCountryAliases: string[] = [];
    for (const [code, aliases] of Object.entries(WebCrawlerService.COUNTRY_ALIASES)) {
      if (code !== country) otherCountryAliases.push(...aliases);
    }

    const scored = urls.map((url) => {
      const path = new URL(url).pathname.toLowerCase();
      let score = 0;

      // Check if URL path has a locale segment
      const hasCountry = countryAliases.some((a) =>
        new RegExp(`/${a}(/|$|-[a-z])`).test(path),
      );
      if (hasCountry) score += 3;

      // Check if URL has a conflicting language (e.g. -ar in /ae-ar when lang=en)
      if (lang) {
        const hasTargetLang = new RegExp(`[-/]${lang}(/|$)`).test(path) ||
          // Combined locale like /ae (without any language suffix) → treat as default locale
          (hasCountry && !otherLangs.some((ol) => ol !== lang && new RegExp(`[-/]${ol}(/|$)`).test(path)));
        if (hasTargetLang) score += 2;
      }

      // Penalize if another country is present
      const hasOtherCountry = otherCountryAliases.some((a) =>
        new RegExp(`/${a}(/|$|-[a-z])`).test(path),
      );
      if (hasOtherCountry && !hasCountry) score -= 5;

      return { url, score };
    });

    // If the site uses locale paths, filter to matching locale only
    const maxScore = Math.max(...scored.map((s) => s.score));
    if (maxScore > 0) {
      // Keep only URLs that have at least a country match (score >= 3) or match both (5)
      const threshold = Math.max(3, maxScore - 2);
      const filtered = scored
        .filter((s) => s.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.url);

      // If locale filtering is too aggressive (e.g. only 2 locale-prefixed pages on an
      // otherwise un-localized site), supplement with non-penalized root pages so the
      // business profile has enough content to analyse.
      if (filtered.length < Math.min(10, limit)) {
        const supplementary = scored
          .filter((s) => s.score >= 0 && s.score < threshold)
          .sort((a, b) => b.score - a.score)
          .map((s) => s.url);
        const combined = [...new Set([...filtered, ...supplementary])];
        return combined.slice(0, limit);
      }

      return filtered.slice(0, limit);
    }

    // No locale-aware URLs detected — return all (non-localized site)
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

  /**
   * Fetch a URL and return both the response body and lower-cased response headers.
   * Used when callers need to inspect HTTP response headers (e.g. X-Robots-Tag).
   * Returns { body: '', headers: {} } on any failure.
   */
  async fetchWithHeaders(
    url: string,
    timeoutMs = 10_000,
  ): Promise<{ body: string; headers: Record<string, string> }> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PulseBot/1.0 (+https://getpulse.ai/bot)' },
      });
      clearTimeout(timer);
      if (!response.ok) return { body: '', headers: {} };
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
      return { body: await response.text(), headers };
    } catch {
      this.logger.warn(`fetchWithHeaders failed for ${url}`);
      return { body: '', headers: {} };
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
