import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ToolRegistry, ToolDefinition } from './tool.registry';
import { AhrefsService } from '../features/integrations/ahrefs/ahrefs.service';
import { SerperService } from '../features/integrations/serper/serper.service';
import { FirecrawlService } from '../features/integrations/firecrawl/firecrawl.service';
import { PageSpeedService } from '../features/integrations/pagespeed/pagespeed.service';
import { DataForSeoService } from '../features/integrations/dataforseo/dataforseo.service';
import { OpenAiService } from '../features/integrations/openai/openai.service';
import { AnthropicService } from '../features/integrations/anthropic/anthropic.service';

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
    private readonly openai: OpenAiService,
    private readonly anthropic: AnthropicService,
  ) {}

  onModuleInit() {
    const tools: ToolDefinition[] = [
      // --- Ahrefs ---
      {
        name: 'ahrefs_matching_terms',
        description: 'Get matching keyword terms for a seed keyword from Ahrefs Keywords Explorer',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
            country: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['keyword'],
        },
        execute: (input: any) => this.ahrefs.getMatchingTerms(input.keyword, input.country, input.limit),
      },
      {
        name: 'ahrefs_serp_overview',
        description: 'Get SERP overview for a keyword showing top-ranking pages and their metrics',
        inputSchema: {
          type: 'object',
          properties: { keyword: { type: 'string' }, country: { type: 'string' } },
          required: ['keyword'],
        },
        execute: (input: any) => this.ahrefs.getSerpOverview(input.keyword, input.country),
      },
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
      // Note: dataforseo_serp was removed — SERP lookups in pipelines go through
      // the Serper.dev pipeline step. No agent definition references this tool.
      {
        name: 'dataforseo_keyword_volume',
        description: 'Get search volume data for keywords via DataForSEO. Location accepts country names or ISO codes. Language accepts ISO 639-1 codes.',
        inputSchema: {
          type: 'object',
          properties: { keywords: { type: 'array', items: { type: 'string' } }, location: { type: 'string', description: 'Country name or ISO code' }, language: { type: 'string', description: 'ISO 639-1 language code' } },
          required: ['keywords'],
        },
        execute: (input: any) => this.dataForSeo.getKeywordSearchVolume(input.keywords, input.location, input.language),
      },
      {
        name: 'dataforseo_keyword_suggestions',
        description: 'Get keyword suggestions for a seed keyword. Location accepts country names or ISO codes. Language accepts ISO 639-1 codes.',
        inputSchema: {
          type: 'object',
          properties: { keyword: { type: 'string' }, location: { type: 'string', description: 'Country name or ISO code' }, language: { type: 'string', description: 'ISO 639-1 language code' }, limit: { type: 'number' } },
          required: ['keyword'],
        },
        execute: (input: any) => this.dataForSeo.getKeywordSuggestions(input.keyword, input.location, input.language, input.limit),
      },
      {
        name: 'dataforseo_keyword_difficulty',
        description: 'Get keyword difficulty scores via DataForSEO. Location accepts country names or ISO codes. Language accepts ISO 639-1 codes.',
        inputSchema: {
          type: 'object',
          properties: { keywords: { type: 'array', items: { type: 'string' } }, location: { type: 'string', description: 'Country name or ISO code' }, language: { type: 'string', description: 'ISO 639-1 language code' } },
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
      // --- Anthropic Inference ---
      {
        name: 'anthropic_ai_inference',
        description:
          'Ask Claude a natural-language question as a real user would and check if a specific brand appears in the AI response. Use this to test actual AI visibility — whether Claude mentions or recommends the brand when asked category-level or comparison questions. Returns the AI response text, whether the brand was mentioned, and the surrounding context.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The question to ask Claude, e.g. "What are the best SEO tools?"',
            },
            brand: {
              type: 'string',
              description: 'The brand name to look for in the AI response',
            },
          },
          required: ['query', 'brand'],
        },
        execute: (input: any) => this.anthropic.inferAiBrandMention(input.query, input.brand),
      },
      // --- OpenAI Inference ---
      {
        name: 'openai_ai_inference',
        description:
          'Ask OpenAI a natural-language question as a real user would and check if a specific brand appears in the AI response. Use this to test ACTUAL AI visibility — whether ChatGPT mentions or recommends the brand when asked category-level or comparison questions. Returns the AI response text, whether the brand was mentioned, position quality (featured/cited/listed/absent), and the surrounding context sentence.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The question to ask OpenAI, e.g. "What are the best banks in Saudi Arabia?" or "Which bank should I use for personal loans in Saudi Arabia?"',
            },
            brand: {
              type: 'string',
              description: 'The brand name to look for in the AI response, e.g. "Saudi National Bank" or "SNB"',
            },
          },
          required: ['query', 'brand'],
        },
        execute: (input: any) => this.openai.inferAiBrandMention(input.query, input.brand),
      },
      // --- OpenAI Image Generation ---
      {
        name: 'generate_image',
        description:
          'Generate an image using gpt-image-1 from a text prompt. Returns the image as a base64-encoded PNG string. Use detailed, descriptive prompts for best results.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Detailed text description of the image to generate. Be specific about style, composition, colors, and subject matter.',
            },
            size: {
              type: 'string',
              enum: ['1024x1024', '1536x1024', '1024x1536'],
              description: 'Image dimensions. Default is 1536x1024 (landscape). Use 1024x1536 for portrait.',
            },
          },
          required: ['prompt'],
        },
        execute: (input: any) => this.openai.generateImage(input.prompt, input.size),
      },
      // --- Structured output submission ---
      {
        name: 'return_output',
        description:
          'Submit your final structured JSON output. Call this tool ONCE as your absolute last action, passing your complete result object as the `data` parameter. The workflow engine captures `data` directly — no text parsing is needed.',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              description: 'Your complete structured JSON output conforming to the required output schema.',
            },
          },
          required: ['data'],
        },
        execute: async (_input: unknown) => ({ received: true }),
      },
    ];

    for (const tool of tools) {
      this.toolRegistry.register(tool);
    }

    this.logger.log(`Registered ${tools.length} integration tools`);
  }
}
