import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ToolRegistry, ToolDefinition } from './tool.registry';
import { AhrefsService } from '../features/integrations/ahrefs/ahrefs.service';
import { SerperService } from '../features/integrations/serper/serper.service';
import { FirecrawlService } from '../features/integrations/firecrawl/firecrawl.service';
import { PageSpeedService } from '../features/integrations/pagespeed/pagespeed.service';
import { DataForSeoService } from '../features/integrations/dataforseo/dataforseo.service';

@Injectable()
export class ToolBootstrap implements OnModuleInit {
  private readonly logger = new Logger(ToolBootstrap.name);

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly ahrefs: AhrefsService,
    private readonly serper: SerperService,
    private readonly firecrawl: FirecrawlService,
    private readonly pagespeed: PageSpeedService,
    private readonly dataForSeo: DataForSeoService,
  ) {}

  onModuleInit() {
    const tools: ToolDefinition[] = [
      // --- Ahrefs ---
      {
        name: 'ahrefs_domain_rating',
        description: 'Get domain rating and authority metrics for a domain',
        inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
        execute: (input: any) => this.ahrefs.getDomainRating(input.domain),
      },
      {
        name: 'ahrefs_organic_keywords',
        description: 'Get organic keywords ranking for a domain',
        inputSchema: {
          type: 'object',
          properties: { domain: { type: 'string' }, country: { type: 'string' }, limit: { type: 'number' } },
          required: ['domain'],
        },
        execute: (input: any) => this.ahrefs.getOrganicKeywords(input.domain, input.country, input.limit),
      },
      {
        name: 'ahrefs_organic_pages',
        description: 'Get top organic pages for a domain',
        inputSchema: {
          type: 'object',
          properties: { domain: { type: 'string' }, country: { type: 'string' }, limit: { type: 'number' } },
          required: ['domain'],
        },
        execute: (input: any) => this.ahrefs.getOrganicPages(input.domain, input.country, input.limit),
      },
      {
        name: 'ahrefs_backlinks_stats',
        description: 'Get backlink statistics for a domain',
        inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
        execute: (input: any) => this.ahrefs.getBacklinksStats(input.domain),
      },
      {
        name: 'ahrefs_competing_domains',
        description: 'Find competing domains in organic search',
        inputSchema: {
          type: 'object',
          properties: { domain: { type: 'string' }, country: { type: 'string' }, limit: { type: 'number' } },
          required: ['domain'],
        },
        execute: (input: any) => this.ahrefs.getCompetingDomains(input.domain, input.country, input.limit),
      },
      {
        name: 'ahrefs_keyword_difficulty',
        description: 'Get keyword difficulty scores for a list of keywords',
        inputSchema: {
          type: 'object',
          properties: { keywords: { type: 'array', items: { type: 'string' } }, country: { type: 'string' } },
          required: ['keywords'],
        },
        execute: (input: any) => this.ahrefs.getKeywordDifficulty(input.keywords, input.country),
      },
      {
        name: 'ahrefs_keyword_volume',
        description: 'Get search volume data for keywords',
        inputSchema: {
          type: 'object',
          properties: { keywords: { type: 'array', items: { type: 'string' } }, country: { type: 'string' } },
          required: ['keywords'],
        },
        execute: (input: any) => this.ahrefs.getKeywordVolume(input.keywords, input.country),
      },
      {
        name: 'ahrefs_related_keywords',
        description: 'Get related keywords for a seed keyword',
        inputSchema: {
          type: 'object',
          properties: { keyword: { type: 'string' }, country: { type: 'string' }, limit: { type: 'number' } },
          required: ['keyword'],
        },
        execute: (input: any) => this.ahrefs.getRelatedKeywords(input.keyword, input.country, input.limit),
      },
      // --- Serper ---
      {
        name: 'serper_search',
        description: 'Search Google via Serper API',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' }, country: { type: 'string' }, num: { type: 'number' } },
          required: ['query'],
        },
        execute: (input: any) => this.serper.search(input),
      },
      {
        name: 'serper_search_batch',
        description: 'Batch search multiple queries via Serper API',
        inputSchema: {
          type: 'object',
          properties: { queries: { type: 'array', items: { type: 'string' } }, country: { type: 'string' } },
          required: ['queries'],
        },
        execute: (input: any) => this.serper.searchBatch(input.queries, input.country),
      },
      // --- Firecrawl ---
      {
        name: 'firecrawl_scrape',
        description: 'Scrape a single URL and extract content',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' }, options: { type: 'object' } },
          required: ['url'],
        },
        execute: (input: any) => this.firecrawl.scrape(input.url, input.options),
      },
      {
        name: 'firecrawl_crawl',
        description: 'Crawl a website starting from a URL',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' }, limit: { type: 'number' } },
          required: ['url'],
        },
        execute: (input: any) => this.firecrawl.crawl(input.url, input.limit),
      },
      {
        name: 'firecrawl_map_site',
        description: 'Get sitemap/URL structure of a website',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        execute: (input: any) => this.firecrawl.mapSite(input.url),
      },
      // --- PageSpeed ---
      {
        name: 'pagespeed_analyze',
        description: 'Run PageSpeed Insights analysis on a URL',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' }, strategy: { type: 'string', enum: ['mobile', 'desktop'] } },
          required: ['url'],
        },
        execute: (input: any) => this.pagespeed.analyze(input.url, input.strategy),
      },
      {
        name: 'pagespeed_crux',
        description: 'Get Chrome UX Report (CrUX) data for an origin',
        inputSchema: { type: 'object', properties: { origin: { type: 'string' } }, required: ['origin'] },
        execute: (input: any) => this.pagespeed.getCruxData(input.origin),
      },
      // --- DataForSEO ---
      {
        name: 'dataforseo_serp',
        description: 'Get SERP results for a keyword',
        inputSchema: {
          type: 'object',
          properties: { keyword: { type: 'string' }, location: { type: 'string' }, language: { type: 'string' } },
          required: ['keyword'],
        },
        execute: (input: any) => this.dataForSeo.getSerpResults(input.keyword, input.location, input.language),
      },
      {
        name: 'dataforseo_keyword_volume',
        description: 'Get search volume data for keywords via DataForSEO',
        inputSchema: {
          type: 'object',
          properties: { keywords: { type: 'array', items: { type: 'string' } }, location: { type: 'string' }, language: { type: 'string' } },
          required: ['keywords'],
        },
        execute: (input: any) => this.dataForSeo.getKeywordSearchVolume(input.keywords, input.location, input.language),
      },
      {
        name: 'dataforseo_keyword_suggestions',
        description: 'Get keyword suggestions for a seed keyword',
        inputSchema: {
          type: 'object',
          properties: { keyword: { type: 'string' }, location: { type: 'string' }, language: { type: 'string' }, limit: { type: 'number' } },
          required: ['keyword'],
        },
        execute: (input: any) => this.dataForSeo.getKeywordSuggestions(input.keyword, input.location, input.language, input.limit),
      },
      {
        name: 'dataforseo_keyword_difficulty',
        description: 'Get keyword difficulty scores via DataForSEO',
        inputSchema: {
          type: 'object',
          properties: { keywords: { type: 'array', items: { type: 'string' } }, location: { type: 'string' }, language: { type: 'string' } },
          required: ['keywords'],
        },
        execute: (input: any) => this.dataForSeo.getKeywordDifficulty(input.keywords, input.location, input.language),
      },
      {
        name: 'dataforseo_onpage_task',
        description: 'Create an on-page SEO analysis task',
        inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
        execute: (input: any) => this.dataForSeo.createOnPageTask(input.url),
      },
      {
        name: 'dataforseo_onpage_summary',
        description: 'Get on-page analysis summary for a task',
        inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
        execute: (input: any) => this.dataForSeo.getOnPageSummary(input.taskId),
      },
      {
        name: 'dataforseo_backlinks_summary',
        description: 'Get backlinks summary for a domain via DataForSEO',
        inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
        execute: (input: any) => this.dataForSeo.getBacklinksSummary(input.domain),
      },
      {
        name: 'dataforseo_domain_technologies',
        description: 'Detect technologies used by a domain',
        inputSchema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] },
        execute: (input: any) => this.dataForSeo.getDomainTechnologies(input.domain),
      },
    ];

    for (const tool of tools) {
      this.toolRegistry.register(tool);
    }

    this.logger.log(`Registered ${tools.length} integration tools`);
  }
}
