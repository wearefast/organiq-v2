import { Injectable, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { DatabaseService } from '../../shared/database/database.service';
import { WebCrawlerService } from '../../shared/web-crawler/web-crawler.service';
import { llmAuditResults, projects } from '../../db/schema';
import { randomUUID } from 'crypto';

// ─── Types ───────────────────────────────────────────────────

export interface BotPermissions {
  GPTBot: 'allowed' | 'blocked' | 'not_specified';
  ClaudeBot: 'allowed' | 'blocked' | 'not_specified';
  PerplexityBot: 'allowed' | 'blocked' | 'not_specified';
  'Google-Extended': 'allowed' | 'blocked' | 'not_specified';
  Applebot: 'allowed' | 'blocked' | 'not_specified';
  'cohere-ai': 'allowed' | 'blocked' | 'not_specified';
}

export interface ContentChecks {
  h1Present: boolean;
  hierarchyValid: boolean;
  metaDescriptionPresent: boolean;
  semanticHtml: boolean;
  imagesWithAlt: number;
  imagesTotal: number;
  jsRenderedOnly: boolean;
}

export interface TrustSignals {
  ssl: boolean;
  hasAboutPage: boolean;
  authorByline: boolean;
  schemaTypes: string[];
  ogTags: boolean;
  twitterTags: boolean;
}

export interface ContentChunking {
  avgParagraphLength: number;
  hasLists: boolean;
  internalLinkCount: number;
}

export interface AuditIssue {
  type: 'bot_blocked' | 'structure' | 'trust' | 'chunking' | 'schema' | 'sitemap';
  severity: 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

export interface PageAuditResult {
  pageUrl: string;
  aiIndexabilityScore: number;
  botPermissions: BotPermissions;
  contentChecks: ContentChecks;
  trustSignals: TrustSignals;
  contentChunking: ContentChunking;
  issues: AuditIssue[];
}

export interface AuditRunSummary {
  auditRunId: string;
  projectId: string;
  overallScore: number;
  pageCount: number;
  results: PageAuditResult[];
  auditedAt: string;
}

// ─── Bot list ────────────────────────────────────────────────

const LLM_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot', 'cohere-ai'] as const;

// ─── Service ─────────────────────────────────────────────────

/** Batch size for concurrent page fetches — keeps concurrency sane without hammering the target site */
const AUDIT_BATCH_SIZE = 5;

@Injectable()
export class LlmAuditService {
  private readonly logger = new Logger(LlmAuditService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly webCrawler: WebCrawlerService,
  ) {}

  // ─── Main entry point ────────────────────────────────────

  /**
   * Audit the project's site using the sitemap URLs already stored on the project.
   * If no sitemap has been discovered yet, falls back to live sitemap discovery.
   *
   * The sitemap is stored on the project during creation (and domain updates),
   * so this method avoids re-crawling the sitemap on every audit run.
   */
  async runAudit(projectId: string): Promise<AuditRunSummary> {
    // Load project — owns the domain and stored sitemap
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!project) throw new Error(`Project ${projectId} not found`);

    const siteUrl = `https://${project.domain}`;
    const origin = new URL(siteUrl).origin;
    const auditRunId = randomUUID();

    // Always fetch fresh robots.txt (needed for bot permission checks, tiny payload)
    const robotsTxt = await this.webCrawler.fetchText(`${origin}/robots.txt`);

    // Use stored sitemap URLs if available; otherwise fall back to live discovery
    let pageUrls: string[];
    let sitemapXml = '';

    if (project.sitemapUrls && project.sitemapUrls.length > 0) {
      pageUrls = project.sitemapUrls;
      this.logger.log(
        `runAudit: using ${pageUrls.length} stored sitemap URL(s) for ${origin}`,
      );
    } else {
      this.logger.log(`runAudit: no stored sitemap for ${origin}, discovering live`);
      const discovery = await this.webCrawler.discoverSitePages(siteUrl, 25, {
        country: project.country ?? undefined,
        language: project.language ?? undefined,
      });
      pageUrls = discovery.pageUrls;
      sitemapXml = discovery.sitemapXml;
    }

    this.logger.log(`runAudit: auditing ${pageUrls.length} page(s) on ${origin}`);

    // Bot permissions are site-wide — evaluate once against robots.txt
    const botPermissions = this.checkBotPermissions(robotsTxt);
    const botIssues = this.botPermissionIssues(botPermissions);

    // Audit pages in batches of AUDIT_BATCH_SIZE to cap concurrency
    const results: PageAuditResult[] = [];
    for (let i = 0; i < pageUrls.length; i += AUDIT_BATCH_SIZE) {
      const batch = pageUrls.slice(i, i + AUDIT_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((url) => this.auditSinglePage(url, botPermissions, botIssues, sitemapXml, origin)),
      );
      results.push(...batchResults.filter((r): r is PageAuditResult => r !== null));
    }

    if (results.length === 0) {
      throw new Error(`Could not fetch any pages from ${origin} — the site may be unreachable`);
    }

    // Persist all page results in a single insert
    await this.db.db.insert(llmAuditResults).values(
      results.map((r) => ({
        projectId,
        auditRunId,
        pageUrl: r.pageUrl,
        aiIndexabilityScore: r.aiIndexabilityScore,
        botPermissions: r.botPermissions,
        contentChecks: r.contentChecks,
        trustSignals: r.trustSignals,
        contentChunking: r.contentChunking,
        issues: r.issues,
      })),
    );

    const overallScore = Math.round(
      results.reduce((sum, r) => sum + r.aiIndexabilityScore, 0) / results.length,
    );

    return {
      auditRunId,
      projectId,
      overallScore,
      pageCount: results.length,
      results,
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetch and audit a single page.
   * Returns null if the page is unreachable (caller skips it gracefully).
   */
  private async auditSinglePage(
    pageUrl: string,
    botPermissions: BotPermissions,
    botIssues: AuditIssue[],
    sitemapXml: string,
    origin: string,
  ): Promise<PageAuditResult | null> {
    const pageHtml = await this.webCrawler.fetchText(pageUrl);
    if (!pageHtml) {
      this.logger.warn(`auditSinglePage: skipping unreachable page ${pageUrl}`);
      return null;
    }

    const contentChecks = this.checkContentStructure(pageHtml);
    const trustSignals = this.checkTrustSignals(pageHtml, origin);
    const contentChunking = this.checkContentChunking(pageHtml);
    const schemaIssues = this.checkSchemaMarkup(pageHtml);
    const sitemapIssues = this.checkSitemap(sitemapXml, pageUrl);

    const issues: AuditIssue[] = [
      ...botIssues,
      ...this.structureIssues(contentChecks),
      ...this.trustIssues(trustSignals),
      ...this.chunkingIssues(contentChunking),
      ...schemaIssues,
      ...sitemapIssues,
    ];

    const aiIndexabilityScore = this.calculateScore(
      botPermissions,
      contentChecks,
      trustSignals,
      contentChunking,
    );

    return { pageUrl, aiIndexabilityScore, botPermissions, contentChecks, trustSignals, contentChunking, issues };
  }

  // ─── Read ────────────────────────────────────────────────

  async getLatestAudit(projectId: string) {
    const rows = await this.db.db
      .select()
      .from(llmAuditResults)
      .where(eq(llmAuditResults.projectId, projectId))
      .orderBy(desc(llmAuditResults.auditedAt))
      .limit(20);
    if (rows.length === 0) return null;

    const auditRunId = rows[0].auditRunId;
    const latestRows = rows.filter((r) => r.auditRunId === auditRunId);

    const overallScore = Math.round(
      latestRows.reduce((sum, r) => sum + (r.aiIndexabilityScore ?? 0), 0) / latestRows.length,
    );

    return {
      auditRunId,
      projectId,
      overallScore,
      pageCount: latestRows.length,
      results: latestRows.map((r) => ({
        pageUrl: r.pageUrl,
        aiIndexabilityScore: r.aiIndexabilityScore ?? 0,
        botPermissions: r.botPermissions as BotPermissions,
        contentChecks: r.contentChecks as ContentChecks,
        trustSignals: r.trustSignals as TrustSignals,
        contentChunking: r.contentChunking as ContentChunking,
        issues: (r.issues as AuditIssue[]) ?? [],
      })),
      auditedAt: latestRows[0].auditedAt.toISOString(),
    };
  }

  async getAuditHistory(projectId: string) {
    const rows = await this.db.db
      .select()
      .from(llmAuditResults)
      .where(eq(llmAuditResults.projectId, projectId))
      .orderBy(desc(llmAuditResults.auditedAt))
      .limit(100);

    // Group by auditRunId
    const runs = new Map<string, typeof rows>();
    for (const row of rows) {
      const group = runs.get(row.auditRunId) ?? [];
      group.push(row);
      runs.set(row.auditRunId, group);
    }

    return Array.from(runs.entries()).map(([runId, runRows]) => ({
      auditRunId: runId,
      overallScore: Math.round(
        runRows.reduce((sum, r) => sum + (r.aiIndexabilityScore ?? 0), 0) / runRows.length,
      ),
      pageCount: runRows.length,
      auditedAt: runRows[0].auditedAt.toISOString(),
    }));
  }

  // ─── Check 1: Bot Permissions (robots.txt) ───────────────

  private checkBotPermissions(robotsTxt: string): BotPermissions {
    const result: Record<string, 'allowed' | 'blocked' | 'not_specified'> = {};
    for (const bot of LLM_BOTS) {
      result[bot] = this.parseBotStatus(robotsTxt, bot);
    }
    return result as unknown as BotPermissions;
  }

  private parseBotStatus(robotsTxt: string, botName: string): 'allowed' | 'blocked' | 'not_specified' {
    if (!robotsTxt) return 'not_specified';

    const lines = robotsTxt.split('\n').map((l) => l.trim().toLowerCase());
    let inBotSection = false;
    let foundSection = false;
    let disallowAll = false;

    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        const agent = line.replace('user-agent:', '').trim();
        if (agent === botName.toLowerCase() || agent === '*') {
          inBotSection = agent === botName.toLowerCase();
          if (inBotSection) foundSection = true;
        } else {
          inBotSection = false;
        }
      } else if (inBotSection && line.startsWith('disallow:')) {
        const path = line.replace('disallow:', '').trim();
        if (path === '/' || path === '/*') {
          disallowAll = true;
        }
      }
    }

    if (foundSection && disallowAll) return 'blocked';
    if (foundSection && !disallowAll) return 'allowed';

    // Check wildcard block
    let inWildcard = false;
    let wildcardBlocked = false;
    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        inWildcard = line.replace('user-agent:', '').trim() === '*';
      } else if (inWildcard && line.startsWith('disallow:')) {
        const path = line.replace('disallow:', '').trim();
        if (path === '/' || path === '/*') wildcardBlocked = true;
      }
    }

    if (wildcardBlocked) return 'blocked';
    return 'not_specified';
  }

  // ─── Check 2: Content Structure ──────────────────────────

  private checkContentStructure(html: string): ContentChecks {
    const $ = cheerio.load(html);

    const h1Present = $('h1').length > 0;

    // Check heading hierarchy (h1 → h2 → h3, no skipping)
    const headings: number[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      headings.push(parseInt(el.tagName.replace('h', '')));
    });
    let hierarchyValid = true;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) {
        hierarchyValid = false;
        break;
      }
    }

    const metaDescriptionPresent = $('meta[name="description"]').length > 0;
    const semanticHtml = $('article, main, section, nav, aside, header, footer').length > 0;

    // Image alt audit
    const allImages = $('img');
    const imagesTotal = allImages.length;
    const imagesWithAlt = allImages.filter((_, el) => {
      const alt = $(el).attr('alt');
      return !!alt && alt.trim().length > 0;
    }).length;

    // JS-only detection: SPA shell with no real content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const jsRenderedOnly = bodyText.length < 100 && ($('#root, #app, #__next').length > 0);

    return { h1Present, hierarchyValid, metaDescriptionPresent, semanticHtml, imagesWithAlt, imagesTotal, jsRenderedOnly };
  }

  // ─── Check 3: Trust Signals ──────────────────────────────

  private checkTrustSignals(html: string, siteUrl: string): TrustSignals {
    const $ = cheerio.load(html);

    const ssl = siteUrl.startsWith('https://');
    const hasAboutPage = $('a[href*="/about"]').length > 0;
    const authorByline = $('[class*="author"], [rel="author"], [itemprop="author"]').length > 0
      || /(?:author|byline|written.by)/i.test($('body').text());

    // Schema.org types from JSON-LD
    const schemaTypes: string[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? '');
        if (data['@type']) schemaTypes.push(data['@type']);
        if (Array.isArray(data['@graph'])) {
          data['@graph'].forEach((item: { '@type'?: string }) => {
            if (item['@type']) schemaTypes.push(item['@type']);
          });
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    const ogTags = $('meta[property^="og:"]').length > 0;
    const twitterTags = $('meta[name^="twitter:"], meta[property^="twitter:"]').length > 0;

    return { ssl, hasAboutPage, authorByline, schemaTypes: [...new Set(schemaTypes)], ogTags, twitterTags };
  }

  // ─── Check 4: Content Chunking ───────────────────────────

  private checkContentChunking(html: string): ContentChunking {
    const $ = cheerio.load(html);

    // Count paragraphs and average sentence length
    const paragraphs = $('p');
    let totalSentences = 0;
    paragraphs.each((_, el) => {
      const text = $(el).text().trim();
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      totalSentences += sentences.length;
    });
    const avgParagraphLength = paragraphs.length > 0
      ? Math.round((totalSentences / paragraphs.length) * 10) / 10
      : 0;

    const hasLists = $('ul, ol').length > 0;

    // Internal links (relative or same-domain)
    let internalLinkCount = 0;
    const canonical = $('link[rel="canonical"]').attr('href');
    const siteHostname = canonical ? new URL(canonical).hostname : '';
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (href.startsWith('/') || href.startsWith('#') || (siteHostname && href.includes(siteHostname))) {
        internalLinkCount++;
      }
    });

    return { avgParagraphLength, hasLists, internalLinkCount };
  }

  // ─── Check 5: Schema Markup ──────────────────────────────

  private checkSchemaMarkup(html: string): AuditIssue[] {
    const issues: AuditIssue[] = [];
    const $ = cheerio.load(html);
    const types = new Set<string>();

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? '');
        if (data['@type']) types.add(data['@type']);
        if (Array.isArray(data['@graph'])) {
          data['@graph'].forEach((item: { '@type'?: string }) => {
            if (item['@type']) types.add(item['@type']);
          });
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    if (types.size === 0) {
      issues.push({
        type: 'schema',
        severity: 'high',
        description: 'No structured data (JSON-LD) found on page',
        fix: 'Add JSON-LD schema markup (Article, Organization, FAQPage, or HowTo) to help LLMs understand page content',
      });
    } else {
      const preferredTypes = ['Article', 'Organization', 'FAQPage', 'HowTo', 'WebPage', 'BreadcrumbList'];
      const hasPreferred = preferredTypes.some((t) => types.has(t));
      if (!hasPreferred) {
        issues.push({
          type: 'schema',
          severity: 'medium',
          description: `Schema types found (${[...types].join(', ')}) but none are AI-priority types`,
          fix: 'Add Article, FAQPage, or HowTo schema to improve LLM comprehension',
        });
      }
    }

    return issues;
  }

  // ─── Check 6: Sitemap ────────────────────────────────────

  private checkSitemap(sitemapXml: string, targetUrl: string): AuditIssue[] {
    const issues: AuditIssue[] = [];

    if (!sitemapXml || sitemapXml.includes('404') || !sitemapXml.includes('<urlset')) {
      issues.push({
        type: 'sitemap',
        severity: 'high',
        description: 'No valid sitemap.xml found at /sitemap.xml',
        fix: 'Create a sitemap.xml listing all indexable pages. LLM crawlers use sitemaps for discovery.',
      });
      return issues;
    }

    // Check if target URL is in sitemap
    const normalizedTarget = targetUrl.replace(/\/$/, '');
    if (!sitemapXml.includes(normalizedTarget)) {
      issues.push({
        type: 'sitemap',
        severity: 'medium',
        description: `Audited URL not found in sitemap.xml`,
        fix: 'Ensure all important pages are listed in sitemap.xml for LLM crawler discovery',
      });
    }

    return issues;
  }

  // ─── Issue generators ────────────────────────────────────

  private botPermissionIssues(perms: BotPermissions): AuditIssue[] {
    const issues: AuditIssue[] = [];
    for (const [bot, status] of Object.entries(perms)) {
      if (status === 'blocked') {
        issues.push({
          type: 'bot_blocked',
          severity: 'high',
          description: `${bot} is blocked in robots.txt`,
          fix: `Remove "Disallow: /" for ${bot} in robots.txt to allow LLM crawling`,
        });
      }
    }
    return issues;
  }

  private structureIssues(checks: ContentChecks): AuditIssue[] {
    const issues: AuditIssue[] = [];
    if (!checks.h1Present) {
      issues.push({ type: 'structure', severity: 'high', description: 'No <h1> tag found', fix: 'Add a clear <h1> that summarizes page content' });
    }
    if (!checks.hierarchyValid) {
      issues.push({ type: 'structure', severity: 'medium', description: 'Heading hierarchy skips levels', fix: 'Use sequential heading levels (h1→h2→h3) without gaps' });
    }
    if (!checks.metaDescriptionPresent) {
      issues.push({ type: 'structure', severity: 'medium', description: 'No meta description found', fix: 'Add a concise meta description summarizing the page' });
    }
    if (!checks.semanticHtml) {
      issues.push({ type: 'structure', severity: 'low', description: 'No semantic HTML5 elements found', fix: 'Wrap content in <article>, <main>, or <section> for better AI parsing' });
    }
    if (checks.imagesTotal > 0 && checks.imagesWithAlt < checks.imagesTotal) {
      issues.push({ type: 'structure', severity: 'medium', description: `${checks.imagesTotal - checks.imagesWithAlt} of ${checks.imagesTotal} images missing alt text`, fix: 'Add descriptive alt text to all images' });
    }
    if (checks.jsRenderedOnly) {
      issues.push({ type: 'structure', severity: 'high', description: 'Page appears to be JS-rendered only (no SSR)', fix: 'Implement server-side rendering for LLM crawlers that cannot execute JavaScript' });
    }
    return issues;
  }

  private trustIssues(signals: TrustSignals): AuditIssue[] {
    const issues: AuditIssue[] = [];
    if (!signals.ssl) {
      issues.push({ type: 'trust', severity: 'high', description: 'Site not served over HTTPS', fix: 'Enable SSL/TLS certificate for secure connections' });
    }
    if (!signals.hasAboutPage) {
      issues.push({ type: 'trust', severity: 'low', description: 'No link to About page found', fix: 'Add an About page link in navigation for E-E-A-T signals' });
    }
    if (!signals.authorByline) {
      issues.push({ type: 'trust', severity: 'medium', description: 'No author byline detected', fix: 'Add author attribution to content pages for credibility' });
    }
    if (!signals.ogTags) {
      issues.push({ type: 'trust', severity: 'low', description: 'No Open Graph meta tags found', fix: 'Add og:title, og:description, og:image for social and AI sharing context' });
    }
    if (!signals.twitterTags) {
      issues.push({ type: 'trust', severity: 'low', description: 'No Twitter Card meta tags found', fix: 'Add twitter:card, twitter:title meta tags' });
    }
    return issues;
  }

  private chunkingIssues(chunking: ContentChunking): AuditIssue[] {
    const issues: AuditIssue[] = [];
    if (chunking.avgParagraphLength > 5) {
      issues.push({ type: 'chunking', severity: 'medium', description: `Average paragraph is ${chunking.avgParagraphLength} sentences (LLMs prefer 2-4)`, fix: 'Break long paragraphs into 2-4 sentence chunks for better AI consumption' });
    }
    if (!chunking.hasLists) {
      issues.push({ type: 'chunking', severity: 'low', description: 'No bullet/numbered lists found', fix: 'Add lists to structure information clearly for AI extraction' });
    }
    if (chunking.internalLinkCount < 3) {
      issues.push({ type: 'chunking', severity: 'medium', description: `Only ${chunking.internalLinkCount} internal links found`, fix: 'Add more internal links (aim for 5+) to help crawlers discover related content' });
    }
    return issues;
  }

  // ─── Scoring ─────────────────────────────────────────────

  private calculateScore(
    bots: BotPermissions,
    content: ContentChecks,
    trust: TrustSignals,
    chunking: ContentChunking,
  ): number {
    // Bot permissions: 25 points
    const botEntries = Object.values(bots);
    const allowedBots = botEntries.filter((s) => s !== 'blocked').length;
    const botScore = Math.round((allowedBots / botEntries.length) * 25);

    // Content structure: 30 points
    let contentScore = 0;
    if (content.h1Present) contentScore += 6;
    if (content.hierarchyValid) contentScore += 6;
    if (content.metaDescriptionPresent) contentScore += 6;
    if (content.semanticHtml) contentScore += 6;
    if (content.imagesTotal === 0 || content.imagesWithAlt === content.imagesTotal) contentScore += 3;
    if (!content.jsRenderedOnly) contentScore += 3;

    // Trust signals: 25 points
    let trustScore = 0;
    if (trust.ssl) trustScore += 7;
    if (trust.hasAboutPage) trustScore += 3;
    if (trust.authorByline) trustScore += 5;
    if (trust.schemaTypes.length > 0) trustScore += 5;
    if (trust.ogTags) trustScore += 3;
    if (trust.twitterTags) trustScore += 2;

    // Content chunking: 20 points
    let chunkScore = 0;
    if (chunking.avgParagraphLength > 0 && chunking.avgParagraphLength <= 4) chunkScore += 8;
    else if (chunking.avgParagraphLength <= 5) chunkScore += 5;
    if (chunking.hasLists) chunkScore += 6;
    if (chunking.internalLinkCount >= 5) chunkScore += 6;
    else if (chunking.internalLinkCount >= 3) chunkScore += 3;

    return Math.min(100, botScore + contentScore + trustScore + chunkScore);
  }

}
