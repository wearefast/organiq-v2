import { Injectable, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import * as cheerio from 'cheerio';
import { DatabaseService } from '../../shared/database/database.service';
import { WebCrawlerService } from '../../shared/web-crawler/web-crawler.service';
import { SitemapRepository } from '../projects/sitemap.repository';
import { llmAuditResults, projects } from '../../db/schema';
import { randomUUID } from 'crypto';

// ─── Types ───────────────────────────────────────────────────

export type BotStatus = 'allowed' | 'blocked' | 'not_specified';

/** Keyed by bot user-agent string. Stored as jsonb so new bots are backwards-compatible. */
export type BotPermissions = Record<string, BotStatus>;

export interface ContentChecks {
  h1Present: boolean;
  hierarchyValid: boolean;
  metaDescriptionPresent: boolean;
  semanticHtml: boolean;
  imagesWithAlt: number;
  imagesTotal: number;
  jsRenderedOnly: boolean;
  // LLM discovery signals (optional — old stored rows pre-date this check)
  llmsTxtPresent?: boolean;
  llmsTxtValid?: boolean;
  pageInLlmsTxt?: boolean;
  llmsFullTxtPresent?: boolean; // /llms-full.txt full-content variant (used by Perplexity & Claude)
  // Content freshness signals (optional — old stored rows pre-date this check)
  dateModifiedPresent?: boolean;
  dateModifiedRecent?: boolean;  // true if dateModified/datePublished is within the last 12 months
  sitemapHasLastmod?: boolean;
}

export interface TrustSignals {
  ssl: boolean;
  hasAboutPage: boolean;
  authorByline: boolean;
  schemaTypes: string[];
  ogTags: boolean;
  twitterTags: boolean;
  // E-E-A-T depth signals (optional — old stored rows pre-date this check)
  hasPersonSchema?: boolean;        // Person JSON-LD with name + url
  hasOrganizationSchema?: boolean;  // Organization / LocalBusiness JSON-LD with name + url
  authorHasCredentials?: boolean;   // Person.sameAs or Person.affiliation present
  // Page-level robots directives (optional — old stored rows pre-date this check)
  metaRobotsNoindex?: boolean;      // <meta name="robots" content="noindex">
  metaRobotsNoai?: boolean;         // <meta name="robots" content="noai">
  xRobotsNoindex?: boolean;         // X-Robots-Tag: noindex response header
  xRobotsNoai?: boolean;            // X-Robots-Tag: noai or noimageai response header
}

export interface ContentChunking {
  avgParagraphLength: number;
  hasLists: boolean;
  internalLinkCount: number;
  // Citation-readiness signals (optional — old stored rows pre-date this check)
  hasFaq?: boolean;
  hasComparisonTable?: boolean;
  hasStepList?: boolean;        // <ol> with ≥3 items
  answerFirst?: boolean;        // substantive paragraph found in first 3 <p> elements
  hasOutboundLinks?: boolean;   // links to .gov, .edu, or .org sources
}

export interface AuditIssue {
  type: 'bot_blocked' | 'structure' | 'trust' | 'chunking' | 'schema' | 'sitemap' | 'llms_txt' | 'freshness' | 'citation' | 'eeat' | 'xrobots';
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
// Organized by category so the UI can group them meaningfully.
// All are significant AI crawlers that publishers routinely encounter in access logs.
const LLM_BOTS = [
  // ── Training crawlers (index content for model training) ──
  'GPTBot',             // OpenAI — ChatGPT / GPT-4 training
  'ClaudeBot',          // Anthropic — Claude training
  'Google-Extended',    // Google — Gemini / AI Overviews training opt-out token
  'Applebot-Extended',  // Apple — Apple Intelligence training
  'cohere-ai',          // Cohere — enterprise RAG model training
  'Bytespider',         // ByteDance (TikTok) — Doubao LLM training
  // ── Search & answer bots (real-time crawl for citations) ──
  'OAI-SearchBot',      // OpenAI — ChatGPT Search real-time index
  'PerplexityBot',      // Perplexity AI — real-time answer crawl
  'Applebot',           // Apple — Siri Knowledge / Spotlight Suggestions
  'DuckAssistBot',      // DuckDuckGo — AI-assisted answer feature
  'Gemini-Deep-Research', // Google — Gemini Deep Research feature
  'Bravebot',           // Brave — Brave Search AI answers
  // ── Real-time user-initiated fetchers ──
  'ChatGPT-User',       // OpenAI — fetches URLs shared by ChatGPT users
  'Claude-User',        // Anthropic — fetches URLs shared by Claude users
  'Perplexity-User',    // Perplexity — fetches pages during user queries
  'meta-externalagent', // Meta — Meta AI search crawler
] as const;

// ─── Service ─────────────────────────────────────────────────

/** Batch size for concurrent page fetches — keeps concurrency sane without hammering the target site */
const AUDIT_BATCH_SIZE = 5;

@Injectable()
export class LlmAuditService {
  private readonly logger = new Logger(LlmAuditService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly webCrawler: WebCrawlerService,
    private readonly sitemapRepository: SitemapRepository,
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
    // Fetch /llms.txt once per run — LLM-native discovery file (llmstxt.org standard).
    // /llms-full.txt is the full-content variant used by Perplexity and Claude.
    // Both return empty string on 404/error; downstream checks handle that gracefully.
    const [llmsTxt, llmsFullTxt] = await Promise.all([
      this.webCrawler.fetchText(`${origin}/llms.txt`).catch(() => ''),
      this.webCrawler.fetchText(`${origin}/llms-full.txt`).catch(() => ''),
    ]);

    // Use stored sitemap URLs if available; otherwise fall back to live discovery
    let pageUrls: string[];
    let sitemapXml = '';

    const storedUrls = await this.sitemapRepository.getUrls(projectId);
    if (storedUrls.length > 0) {
      pageUrls = storedUrls;
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

    // P0 fix: when stored URLs are used, sitemapXml is '' above — fetch the raw XML now so that
    // the <lastmod> freshness check can run. Non-fatal if the sitemap is unreachable.
    if (!sitemapXml) {
      sitemapXml = await this.webCrawler.fetchText(`${origin}/sitemap.xml`).catch(() => '');
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
        batch.map((url) => this.auditSinglePage(url, botPermissions, botIssues, llmsTxt, llmsFullTxt, sitemapXml, origin)),
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
    llmsTxt: string,
    llmsFullTxt: string,
    sitemapXml: string,
    origin: string,
  ): Promise<PageAuditResult | null> {
    const { body: pageHtml, headers: pageHeaders } = await this.webCrawler.fetchWithHeaders(pageUrl);
    if (!pageHtml) {
      this.logger.warn(`auditSinglePage: skipping unreachable page ${pageUrl}`);
      return null;
    }

    const contentChecks = this.checkContentStructure(pageHtml);
    const trustSignals = this.checkTrustSignals(pageHtml, origin);
    const contentChunking = this.checkContentChunking(pageHtml);
    const schemaIssues = this.checkSchemaMarkup(pageHtml);
    const sitemapIssues = this.checkSitemap(sitemapXml, pageUrl);
    const { present: llmsTxtPresent, valid: llmsTxtValid, pageReferenced: pageInLlmsTxt, fullPresent: llmsFullTxtPresent, issues: llmsIssues } =
      this.checkLlmsTxt(llmsTxt, llmsFullTxt, pageUrl);
    const { dateModifiedPresent, dateModifiedRecent, sitemapHasLastmod, issues: freshnessIssues } =
      this.checkContentFreshness(pageHtml, sitemapXml, pageUrl);
    const { hasFaq, hasComparisonTable, hasStepList, answerFirst, hasOutboundLinks, issues: citationIssues } =
      this.checkCitationReadiness(pageHtml);
    const { metaRobotsNoindex, metaRobotsNoai, xRobotsNoindex, xRobotsNoai, issues: robotsIssues } =
      this.checkRobotsDirectives(pageHtml, pageHeaders);

    // Merge optional signals into the respective jsonb columns — no schema migration needed
    const fullContentChecks: ContentChecks = {
      ...contentChecks,
      llmsTxtPresent, llmsTxtValid, pageInLlmsTxt, llmsFullTxtPresent,
      dateModifiedPresent, dateModifiedRecent, sitemapHasLastmod,
    };
    const fullContentChunking: ContentChunking = {
      ...contentChunking,
      hasFaq, hasComparisonTable, hasStepList, answerFirst, hasOutboundLinks,
    };
    const fullTrustSignals: TrustSignals = { ...trustSignals, metaRobotsNoindex, metaRobotsNoai, xRobotsNoindex, xRobotsNoai };

    const issues: AuditIssue[] = [
      ...botIssues,
      ...this.structureIssues(contentChecks),
      ...this.trustIssues(fullTrustSignals),
      ...this.chunkingIssues(contentChunking),
      ...schemaIssues,
      ...sitemapIssues,
      ...llmsIssues,
      ...freshnessIssues,
      ...citationIssues,
      ...robotsIssues,
    ];

    const aiIndexabilityScore = this.calculateScore(
      botPermissions,
      fullContentChecks,
      fullTrustSignals,
      fullContentChunking,
    );

    return { pageUrl, aiIndexabilityScore, botPermissions, contentChecks: fullContentChecks, trustSignals: fullTrustSignals, contentChunking: fullContentChunking, issues };
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
    const result: Record<string, BotStatus> = {};
    for (const bot of LLM_BOTS) {
      result[bot] = this.parseBotStatus(robotsTxt, bot);
    }
    return result;
  }

  private parseBotStatus(robotsTxt: string, botName: string): BotStatus {
    if (!robotsTxt) return 'not_specified';

    const lines = robotsTxt.split('\n').map((l) => l.trim().toLowerCase());
    const bot = botName.toLowerCase();

    // ── Pass 1: find rules in the bot's own named section ─────────────────────
    let inBotSection = false;
    let foundSection = false;
    let disallowAll = false;
    let allowRoot = false; // Allow: / in the same section overrides Disallow: /

    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        const agent = line.replace('user-agent:', '').trim();
        inBotSection = agent === bot;
        if (inBotSection) foundSection = true;
      } else if (inBotSection) {
        if (line.startsWith('disallow:')) {
          const path = line.replace('disallow:', '').trim();
          if (path === '/' || path === '/*') disallowAll = true;
        } else if (line.startsWith('allow:')) {
          const path = line.replace('allow:', '').trim();
          // Allow: / explicitly grants root access — overrides a Disallow: /
          if (path === '/' || path === '') allowRoot = true;
        }
      }
    }

    if (foundSection) {
      // Named section found: blocked only if root is disallowed and not explicitly re-allowed
      return disallowAll && !allowRoot ? 'blocked' : 'allowed';
    }

    // ── Pass 2: fall back to wildcard (*) rules ────────────────────────────────
    let inWildcard = false;
    let wildcardDisallowAll = false;
    let wildcardAllowRoot = false;

    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        inWildcard = line.replace('user-agent:', '').trim() === '*';
      } else if (inWildcard) {
        if (line.startsWith('disallow:')) {
          const path = line.replace('disallow:', '').trim();
          if (path === '/' || path === '/*') wildcardDisallowAll = true;
        } else if (line.startsWith('allow:')) {
          const path = line.replace('allow:', '').trim();
          if (path === '/' || path === '') wildcardAllowRoot = true;
        }
      }
    }

    if (wildcardDisallowAll && !wildcardAllowRoot) return 'blocked';
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

    // Improved author byline: prefer structural HTML attributes; scope text search to main/article
    // to avoid firing on copyright footers and site-wide boilerplate text.
    const authorByline =
      $('[class*="author"], [rel="author"], [itemprop="author"], [data-author]').length > 0 ||
      /\bby\s+[A-Z][a-z]+|written\s+by\b/i.test($('main, article').text());

    // Schema.org types from JSON-LD + E-E-A-T depth detection
    const schemaTypes: string[] = [];
    let hasPersonSchema = false;
    let hasOrganizationSchema = false;
    let authorHasCredentials = false;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() ?? '');
        const nodes: Array<Record<string, unknown>> = [data];
        if (Array.isArray(data['@graph'])) {
          nodes.push(...(data['@graph'] as Array<Record<string, unknown>>));
        }
        for (const node of nodes) {
          const type = node['@type'] as string | undefined;
          if (type) schemaTypes.push(type);

          // Person schema: must have both name + url to count as an E-E-A-T credentialing signal
          if (type === 'Person' && node.name && node.url) {
            hasPersonSchema = true;
            // Author credentials: sameAs (LinkedIn, Wikipedia, ORCID, etc.) or affiliation
            if (node.sameAs || node.affiliation) authorHasCredentials = true;
          }

          // Organization schema: must have name + url to count as entity establishment
          if ((type === 'Organization' || type === 'LocalBusiness') && node.name && node.url) {
            hasOrganizationSchema = true;
          }
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    const ogTags = $('meta[property^="og:"]').length > 0;
    const twitterTags = $('meta[name^="twitter:"], meta[property^="twitter:"]').length > 0;

    return {
      ssl, hasAboutPage, authorByline,
      schemaTypes: [...new Set(schemaTypes)], ogTags, twitterTags,
      hasPersonSchema, hasOrganizationSchema, authorHasCredentials,
    };
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

  // ─── Check 7: /llms.txt (llmstxt.org standard) ───────────────────────────

  private checkLlmsTxt(
    llmsTxt: string,
    llmsFullTxt: string,
    pageUrl: string,
  ): { present: boolean; valid: boolean; pageReferenced: boolean; fullPresent: boolean; issues: AuditIssue[] } {
    // /llms-full.txt is independent of /llms.txt — credit it even when /llms.txt is absent
    const fullPresent = llmsFullTxt.trim().length > 10;

    if (!llmsTxt || llmsTxt.trim().length < 10) {
      return {
        present: false,
        valid: false,
        pageReferenced: false,
        fullPresent,
        issues: [{
          type: 'llms_txt',
          severity: 'high',
          description: 'No /llms.txt file found at site root',
          fix: 'Create /llms.txt — a Markdown file summarising your site for LLMs. Must begin with # Site Name and > Brief description. See llmstxt.org.',
        }],
      };
    }

    // Structural validation per llmstxt.org spec: must have H1 + blockquote
    const hasH1 = /^#\s+.+/m.test(llmsTxt);
    const hasBlockquote = /^>\s+.+/m.test(llmsTxt);
    const valid = hasH1 && hasBlockquote;

    const issues: AuditIssue[] = [];
    if (!valid) {
      issues.push({
        type: 'llms_txt',
        severity: 'medium',
        description: '/llms.txt found but missing required structure (H1 + blockquote)',
        fix: 'Your /llms.txt must begin with # Site Name (H1) and > Brief description (blockquote) per the llmstxt.org specification',
      });
    }

    // Page-level: is this specific URL referenced in llms.txt?
    // Check both trailing-slash and non-trailing-slash variants since authors may use either form.
    const normalizedUrl = pageUrl.replace(/\/$/, '');
    const pageReferenced = llmsTxt.includes(normalizedUrl) || llmsTxt.includes(normalizedUrl + '/');

    if (valid && !pageReferenced) {
      issues.push({
        type: 'llms_txt',
        severity: 'low',
        description: 'Page not referenced in /llms.txt',
        fix: 'Add this page URL and a brief description to a section in /llms.txt so AI agents can discover and prioritise this content',
      });
    }

    // /llms-full.txt: Perplexity and Claude use this full-content dump for direct content injection
    if (valid && !fullPresent) {
      issues.push({
        type: 'llms_txt',
        severity: 'low',
        description: '/llms-full.txt not found — Perplexity and Claude use this for direct content injection without re-crawling',
        fix: 'Create /llms-full.txt with the complete text of your key pages. This unlocks direct content injection by Perplexity AI and Claude. See llmstxt.org for the full-content variant spec.',
      });
    }

    return { present: true, valid, pageReferenced, fullPresent, issues };
  }

  // ─── Check 8: Content Freshness ──────────────────────────────────

  private checkContentFreshness(
    html: string,
    sitemapXml: string,
    pageUrl: string,
  ): { dateModifiedPresent: boolean; dateModifiedRecent: boolean; sitemapHasLastmod: boolean; issues: AuditIssue[] } {
    const $ = cheerio.load(html);
    const issues: AuditIssue[] = [];

    // 1. dateModified / datePublished in JSON-LD schema
    let dateModifiedPresent = false;
    let dateModifiedRecent = false;
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    $('script[type="application/ld+json"]').each((_, el) => {
      if (dateModifiedPresent) return false as unknown as void; // break — date already found
      try {
        const data = JSON.parse($(el).html() ?? '');
        const nodes: Array<Record<string, unknown>> = [data];
        if (Array.isArray(data['@graph'])) {
          nodes.push(...(data['@graph'] as Array<Record<string, unknown>>));
        }
        for (const node of nodes) {
          const rawDate = (node.dateModified ?? node.datePublished) as string | undefined;
          if (rawDate) {
            dateModifiedPresent = true;
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) dateModifiedRecent = d > twelveMonthsAgo;
            break;
          }
        }
      } catch { /* skip invalid JSON-LD */ }
    });

    if (!dateModifiedPresent) {
      issues.push({
        type: 'freshness',
        severity: 'high',
        description: 'No dateModified in JSON-LD schema',
        fix: 'Add dateModified (ISO 8601) to your Article or WebPage JSON-LD schema. AI answer engines deprioritize undated content.',
      });
    } else if (!dateModifiedRecent) {
      issues.push({
        type: 'freshness',
        severity: 'medium',
        description: 'dateModified is older than 12 months',
        fix: 'Update dateModified whenever you refresh page content. Real-time AI answer engines favour recently updated pages.',
      });
    }

    // 2. <lastmod> in sitemap for this page — only flag if we have sitemap XML to inspect
    const normalizedUrl = pageUrl.replace(/\/$/, '');
    let sitemapHasLastmod = false;

    if (sitemapXml && sitemapXml.includes('<urlset')) {
      const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = urlBlockRegex.exec(sitemapXml)) !== null) {
        const block = urlMatch[1];
        const locMatch = block.match(/<loc>(.*?)<\/loc>/);
        if (locMatch) {
          const loc = locMatch[1].replace(/\/$/, '');
          if (loc === normalizedUrl && block.includes('<lastmod>')) {
            sitemapHasLastmod = true;
            break;
          }
        }
      }
      if (!sitemapHasLastmod) {
        issues.push({
          type: 'freshness',
          severity: 'medium',
          description: 'No <lastmod> in sitemap.xml for this page',
          fix: 'Add <lastmod> to each <url> in sitemap.xml. Crawlers use this to prioritise re-fetching recently updated content.',
        });
      }
    }

    return { dateModifiedPresent, dateModifiedRecent, sitemapHasLastmod, issues };
  }

  // ─── Check 9: Citation Readiness ─────────────────────────────────

  private checkCitationReadiness(html: string): {
    hasFaq: boolean;
    hasComparisonTable: boolean;
    hasStepList: boolean;
    answerFirst: boolean;
    hasOutboundLinks: boolean;
    issues: AuditIssue[];
  } {
    const $ = cheerio.load(html);
    const issues: AuditIssue[] = [];

    // 1. FAQ section: FAQPage JSON-LD, or <details>/<summary>, or <dt>/<dd> pairs
    let hasFaq = false;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (hasFaq) return false as unknown as void; // break — FAQ already found
      try {
        const data = JSON.parse($(el).html() ?? '');
        const nodes: Array<Record<string, unknown>> = [data];
        if (Array.isArray(data['@graph'])) {
          nodes.push(...(data['@graph'] as Array<Record<string, unknown>>));
        }
        if (nodes.some((n) => n['@type'] === 'FAQPage')) hasFaq = true;
      } catch { /* skip */ }
    });
    if (!hasFaq) hasFaq = $('details summary, dl dt').length > 3;

    // 2. Comparison table: <table> with a header row (thead or th cells)
    const hasComparisonTable = $('table').filter((_, el) => $(el).find('thead, th').length > 0).length > 0;

    // 3. Step-by-step numbered list: <ol> with ≥3 direct <li> children
    const hasStepList = $('ol').filter((_, el) => $(el).find('> li').length >= 3).length > 0;

    // 4. Answer-first: a substantive paragraph (>80 chars) in the first 3 <p> elements of main content
    const mainContent = $('main, article').first();
    const container = mainContent.length ? mainContent : $('body');
    let answerFirst = false;
    container.find('p').slice(0, 3).each((_, el) => {
      if (!answerFirst && $(el).text().trim().length > 80) answerFirst = true;
    });

    // 5. Outbound links to authoritative domains (.gov, .edu, .org)
    const authorityRe = /^https?:\/\/[^/]+\.(gov|edu|org)(\/|$)/i;
    let hasOutboundLinks = false;
    $('a[href]').each((_, el) => {
      if (!hasOutboundLinks && authorityRe.test($(el).attr('href') ?? '')) hasOutboundLinks = true;
    });

    if (!hasFaq) {
      issues.push({
        type: 'citation',
        severity: 'medium',
        description: 'No FAQ section detected',
        fix: 'Add a FAQ section with FAQPage JSON-LD or <details>/<summary> HTML. FAQs are the most-cited format in AI Overviews.',
      });
    }
    if (!hasComparisonTable) {
      issues.push({
        type: 'citation',
        severity: 'low',
        description: 'No comparison table found',
        fix: 'Add a <table> with a header row for comparisons or feature matrices. AI systems efficiently extract and cite tabular data.',
      });
    }
    if (!hasStepList) {
      issues.push({
        type: 'citation',
        severity: 'low',
        description: 'No numbered step list found (≥3 steps)',
        fix: 'Add an <ol> with 3+ steps for processes or how-to content. Step lists are prominently featured in AI Overviews.',
      });
    }
    if (!hasOutboundLinks) {
      issues.push({
        type: 'citation',
        severity: 'low',
        description: 'No outbound links to authoritative sources (.gov, .edu, .org)',
        fix: 'Link to primary sources and authoritative references. AI systems assign higher trust to content that cites evidence.',
      });
    }

    return { hasFaq, hasComparisonTable, hasStepList, answerFirst, hasOutboundLinks, issues };
  }

  // ─── Check 10: Page-Level Robots Directives ────────────────────────

  private checkRobotsDirectives(
    html: string,
    headers: Record<string, string>,
  ): {
    metaRobotsNoindex: boolean;
    metaRobotsNoai: boolean;
    xRobotsNoindex: boolean;
    xRobotsNoai: boolean;
    issues: AuditIssue[];
  } {
    const $ = cheerio.load(html);
    const issues: AuditIssue[] = [];

    // 1. <meta name="robots"> content attribute — page-level crawl directive
    const metaContent = ($('meta[name="robots"]').attr('content') ?? '').toLowerCase();
    const metaDirectives = metaContent.split(/[\s,]+/);
    const metaRobotsNoindex = metaDirectives.includes('noindex') || metaDirectives.includes('none');
    const metaRobotsNoai = metaDirectives.includes('noai') || metaDirectives.includes('noimageai');

    // 2. X-Robots-Tag HTTP response header (lower-cased by fetchWithHeaders)
    const xRobotsRaw = (headers['x-robots-tag'] ?? '').toLowerCase();
    const xRobotsDirectives = xRobotsRaw.split(/[\s,;]+/);
    const xRobotsNoindex = xRobotsDirectives.includes('noindex') || xRobotsDirectives.includes('none');
    const xRobotsNoai = xRobotsDirectives.includes('noai') || xRobotsDirectives.includes('noimageai');

    if (metaRobotsNoindex) {
      issues.push({
        type: 'xrobots',
        severity: 'high',
        description: 'Page has <meta name="robots" content="noindex"> — excluded from all crawlers',
        fix: 'Remove "noindex" from the meta robots tag to allow AI crawlers to index this page.',
      });
    }
    if (metaRobotsNoai) {
      issues.push({
        type: 'xrobots',
        severity: 'high',
        description: 'Page has <meta name="robots" content="noai"> — explicitly blocks AI crawlers',
        fix: 'Remove "noai" and "noimageai" from the meta robots tag to restore AI crawler access.',
      });
    }
    if (xRobotsNoindex) {
      issues.push({
        type: 'xrobots',
        severity: 'high',
        description: 'X-Robots-Tag: noindex header blocks all crawlers including AI bots',
        fix: 'Remove or update the X-Robots-Tag response header to allow AI crawlers to index this page.',
      });
    }
    if (xRobotsNoai) {
      issues.push({
        type: 'xrobots',
        severity: 'high',
        description: 'X-Robots-Tag: noai/noimageai header explicitly blocks AI training crawlers',
        fix: 'Remove "noai" and "noimageai" from X-Robots-Tag if you want AI training crawlers to access this page.',
      });
    }

    return { metaRobotsNoindex, metaRobotsNoai, xRobotsNoindex, xRobotsNoai, issues };
  }

  // ─── Issue generators ────────────────────────────────────────────

  private botPermissionIssues(perms: BotPermissions): AuditIssue[] {
    const blocked = Object.entries(perms)
      .filter(([, status]) => status === 'blocked')
      .map(([bot]) => bot);

    if (blocked.length === 0) return [];

    // Consolidate all blocked bots into one issue — prevents flooding the recommendations panel
    const botList = blocked.join(', ');
    const disallowList = blocked.map((b) => `"Disallow: /" for ${b}`).join('; remove ');
    return [{
      type: 'bot_blocked',
      severity: 'high',
      description: `${blocked.length} AI bot${blocked.length > 1 ? 's' : ''} blocked in robots.txt: ${botList}`,
      fix: `In robots.txt, remove ${disallowList} to restore LLM crawl access`,
    }];
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
    // E-E-A-T depth issues — only surface these when the check ran (fresh audit, not old stored row)
    if (signals.hasPersonSchema === false) {
      issues.push({
        type: 'eeat',
        severity: 'medium',
        description: 'No Person schema with name + url found',
        fix: 'Add Person JSON-LD schema (name, url, sameAs) on author and about pages. This is the primary E-E-A-T credentialing signal for Google AI Overviews.',
      });
    }
    if (signals.hasOrganizationSchema === false) {
      issues.push({
        type: 'eeat',
        severity: 'low',
        description: 'No Organization schema with name + url found',
        fix: 'Add Organization JSON-LD (name, url, logo) to establish entity identity for AI answer systems.',
      });
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

  // Priority bots: blocking any of these is a critical AI-visibility failure
  private static readonly PRIORITY_BOTS = ['GPTBot', 'ClaudeBot', 'OAI-SearchBot', 'PerplexityBot', 'Google-Extended'] as const;

  private calculateScore(
    bots: BotPermissions,
    content: ContentChecks,
    trust: TrustSignals,
    chunking: ContentChunking,
  ): number {
    // Bot permissions: 20 points
    // Explicit 'allowed' earns full credit; 'not_specified' earns half credit; 'blocked' earns none.
    // This rewards sites that explicitly allow AI bots rather than passively relying on defaults.
    const botEntries = Object.entries(bots);
    const allowedCount = botEntries.filter(([, s]) => s === 'allowed').length;
    const notSpecifiedCount = botEntries.filter(([, s]) => s === 'not_specified').length;
    const botScore = Math.round((allowedCount + notSpecifiedCount * 0.5) / botEntries.length * 20);

    // Hard penalty cap: if any priority bot is blocked, or the page has a noindex directive,
    // the site is fundamentally inaccessible to AI — cap the total at 40 (top of 'Needs Work').
    const hasBlockedPriorityBot = LlmAuditService.PRIORITY_BOTS.some((b) => bots[b] === 'blocked');
    const isPageBlocked = trust.metaRobotsNoindex === true || trust.xRobotsNoindex === true;
    const scoreMax = (hasBlockedPriorityBot || isPageBlocked) ? 40 : 100;

    // Content structure: 25 points (reduced from 30 — reflects that structure is necessary but
    // E-E-A-T and freshness are more decisive for AI citation decisions in 2025+)
    let contentScore = 0;
    if (content.h1Present) contentScore += 5;
    if (content.hierarchyValid) contentScore += 5;
    if (content.metaDescriptionPresent) contentScore += 5;
    if (content.semanticHtml) contentScore += 5;
    if (content.imagesTotal === 0 || content.imagesWithAlt === content.imagesTotal) contentScore += 2;
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

    // LLM Discovery bonus: up to +12 pts for /llms.txt signals (capped at 100 with base score)
    let llmsBonus = 0;
    if (content.llmsTxtPresent) llmsBonus += 5;
    if (content.llmsTxtValid) llmsBonus += 3;
    if (content.pageInLlmsTxt) llmsBonus += 2;
    if (content.llmsFullTxtPresent) llmsBonus += 2; // /llms-full.txt full-content variant bonus

    // Content Freshness bonus: up to +7 pts
    let freshnessBonus = 0;
    if (content.dateModifiedPresent && content.dateModifiedRecent) freshnessBonus += 4;
    if (content.sitemapHasLastmod) freshnessBonus += 3;

    // Citation Readiness bonus: up to +20 pts
    let citationBonus = 0;
    if (chunking.hasFaq) citationBonus += 5;
    if (chunking.hasComparisonTable) citationBonus += 4;
    if (chunking.hasStepList) citationBonus += 4;
    if (chunking.answerFirst) citationBonus += 4;
    if (chunking.hasOutboundLinks) citationBonus += 3;

    // E-E-A-T depth bonus: up to +8 pts
    let eeaatBonus = 0;
    if (trust.hasPersonSchema) eeaatBonus += 4;
    if (trust.hasOrganizationSchema) eeaatBonus += 2;
    if (trust.authorHasCredentials) eeaatBonus += 2;

    const rawScore = Math.min(100, botScore + contentScore + trustScore + chunkScore + llmsBonus + freshnessBonus + citationBonus + eeaatBonus);
    return Math.min(rawScore, scoreMax);
  }

}
