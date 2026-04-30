import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  title: string;
  metaDescription: string;
  h1s: string[];
  bodyText: string;
  internalLinkCount: number;
  imageAltCoverage: number;
  schemaMarkupPresent: boolean;
  siteName: string;
  ogImage: string;
  favicon: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async scrape(url: string): Promise<ScrapeResult> {
    this.logger.log(`Scraping ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalibrateBot/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Scrape failed: HTTP ${response.status} for ${url}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-visible elements
    $('script, style, noscript, iframe, svg').remove();

    const title = $('title').first().text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean);

    // Visible body text, collapsed whitespace, capped at 3000 chars
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);

    // Internal links: same origin or relative paths
    const parsedUrl = new URL(url);
    let internalLinkCount = 0;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === parsedUrl.hostname) {
          internalLinkCount++;
        }
      } catch {
        // relative paths that fail URL parsing are internal
        if (href.startsWith('/') || href.startsWith('#')) {
          internalLinkCount++;
        }
      }
    });

    // Image alt coverage
    const images = $('img');
    const totalImages = images.length;
    const imagesWithAlt = images.filter((_, el) => {
      const alt = $(el).attr('alt');
      return alt !== undefined && alt.trim() !== '';
    }).length;
    const imageAltCoverage = totalImages > 0
      ? Math.round((imagesWithAlt / totalImages) * 100)
      : 100; // no images = nothing to flag

    // Schema markup (JSON-LD or microdata)
    const schemaMarkupPresent =
      $('script[type="application/ld+json"]').length > 0 ||
      $('[itemscope]').length > 0;

    // Organisation name: og:site_name → JSON-LD → title tag
    let siteName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
    if (!siteName) {
      try {
        const ldScripts = $('script[type="application/ld+json"]');
        ldScripts.each((_, el) => {
          if (siteName) return;
          try {
            const ld = JSON.parse($(el).text());
            const items = Array.isArray(ld) ? ld : [ld];
            for (const item of items) {
              if (item.name && (item['@type'] === 'Organization' || item['@type'] === 'WebSite')) {
                siteName = item.name;
                break;
              }
            }
          } catch { /* ignore malformed JSON-LD */ }
        });
      } catch { /* ignore */ }
    }
    if (!siteName) siteName = title.split(/[|\-–—]/).map(s => s.trim()).pop() || title;

    // Logo / OG image
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || '';

    // Favicon: apple-touch-icon → icon link → /favicon.ico fallback
    let favicon = $('link[rel="apple-touch-icon"]').attr('href')?.trim()
      || $('link[rel="icon"]').attr('href')?.trim()
      || $('link[rel="shortcut icon"]').attr('href')?.trim()
      || '';
    if (favicon && !favicon.startsWith('http')) {
      try { favicon = new URL(favicon, url).href; } catch { /* keep as-is */ }
    }
    if (!favicon) {
      favicon = `${parsedUrl.origin}/favicon.ico`;
    }

    this.logger.log(
      `Scraped ${url}: title="${title.slice(0, 50)}", ${h1s.length} H1s, ${internalLinkCount} internal links, ${totalImages} images (${imageAltCoverage}% alt), schema=${schemaMarkupPresent}`,
    );

    return {
      title,
      metaDescription,
      h1s,
      bodyText,
      internalLinkCount,
      imageAltCoverage,
      schemaMarkupPresent,
      siteName,
      ogImage,
      favicon,
    };
  }
}
