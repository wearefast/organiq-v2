/**
 * Generates the architecture map data JSON from source-of-truth files.
 * Run with: npx tsx scripts/generate-architecture-map.ts
 * Output: docs/architecture-map/data.json
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'src');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'architecture-map');

// ------- YAML frontmatter parser (simple, no deps) -------
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const result: Record<string, any> = {};
  let currentKey = '';
  let currentArray: string[] | null = null;

  for (const line of yaml.split('\n')) {
    const arrayItem = line.match(/^\s+-\s+(.+)/);
    if (arrayItem && currentKey) {
      if (!currentArray) currentArray = [];
      currentArray.push(arrayItem[1].trim());
      result[currentKey] = currentArray;
      continue;
    }
    if (currentArray) {
      currentArray = null;
    }
    const kv = line.match(/^(\w[\w_-]*):\s*(.*)/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val === '' || val === '[]') {
        result[currentKey] = [];
      } else if (val === 'true') {
        result[currentKey] = true;
      } else if (val === 'false') {
        result[currentKey] = false;
      } else if (/^\d+$/.test(val)) {
        result[currentKey] = parseInt(val, 10);
      } else {
        result[currentKey] = val.replace(/^["']|["']$/g, '');
      }
      if (Array.isArray(result[currentKey])) {
        currentArray = result[currentKey];
      }
    }
  }
  return result;
}

// ------- Parse agent definitions -------
function parseAgentDefinitions() {
  const dir = path.join(SERVER, 'agents', 'definitions');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.agent.md'));
  return files.map(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const meta = parseFrontmatter(content);
    return {
      stepKey: meta.step_key || file.replace('.agent.md', ''),
      name: meta.name || meta.step_key,
      executionType: meta.execution_type || 'unknown',
      skill: meta.skill || null,
      dependsOn: Array.isArray(meta.depends_on) ? meta.depends_on : [],
      creditCost: meta.credit_cost || 0,
      requiresApproval: meta.requires_approval || false,
      tools: Array.isArray(meta.tools) ? meta.tools : [],
    };
  });
}

// ------- Parse prompt files -------
function parsePromptFiles() {
  const prompts: Record<string, { systemPrompt: string; userPrompt: string }> = {};
  const promptDirs = [
    'discovery', 'intelligence', 'competitors', 'research',
    'strategy', 'topical-map', 'content', 'articles', 'content-images', 'audit'
  ];

  for (const dir of promptDirs) {
    const fullPath = path.join(SERVER, 'prompts', dir);
    if (!fs.existsSync(fullPath)) continue;
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.prompt.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(fullPath, file), 'utf-8');
      const parts = content.split('\n---\n');
      const stepKey = file.replace('.prompt.md', '');
      // Map known prompt filenames to step keys
      const keyMap: Record<string, string> = { 'consolidation': 'consolidated-keywords' };
      const mappedKey = keyMap[stepKey] || stepKey;
      prompts[mappedKey] = {
        systemPrompt: parts[0]?.trim() || '',
        userPrompt: parts[1]?.trim() || '',
      };
    }
  }
  return prompts;
}

// ------- Parse skill files -------
function parseSkillFiles() {
  const skills: Record<string, string> = {};
  const dir = path.join(SERVER, 'skills');
  if (!fs.existsSync(dir)) return skills;
  const folders = fs.readdirSync(dir).filter(f =>
    fs.statSync(path.join(dir, f)).isDirectory()
  );
  for (const folder of folders) {
    const skillFile = path.join(dir, folder, 'skill.md');
    if (!fs.existsSync(skillFile)) continue;
    const content = fs.readFileSync(skillFile, 'utf-8');
    // Take first 15 lines as summary
    const summary = content.split('\n').slice(0, 15).join('\n').trim();
    skills[folder] = summary;
  }
  return skills;
}

// ------- Build tool registry data -------
function parseTools() {
  const file = path.join(SERVER, 'agents', 'tool.bootstrap.ts');
  const content = fs.readFileSync(file, 'utf-8');
  const tools: { name: string; description: string; integration: string }[] = [];

  const regex = /{\s*name:\s*'([^']+)',\s*description:\s*'([^']*(?:'\s*\+\s*'[^']*)*)'|{\s*name:\s*'([^']+)',\s*description:\s*\n?\s*'([^']*(?:'\s*\+\s*'[^']*)*)'|{\s*name:\s*'([^']+)',[\s\S]*?description:\s*(?:'([^']*)'|"([^"]*)"|\n\s*'([^']*)')/g;
  
  // Simpler approach: find all tool name/description pairs
  const nameRegex = /name:\s*'([^']+)'/g;
  const descRegex = /description:\s*(?:'([^']*(?:\\.[^']*)*)'|"([^"]*(?:\\.[^"]*)*)")/g;
  
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = nameRegex.exec(content)) !== null) {
    names.push(m[1]);
  }

  // Map tool names to integrations
  const integrationMap: Record<string, string> = {
    'ahrefs': 'Ahrefs',
    'serper': 'Serper.dev',
    'firecrawl': 'Firecrawl',
    'pagespeed': 'PageSpeed / CrUX',
    'dataforseo': 'DataForSEO',
    'anthropic': 'Anthropic Claude',
    'openai': 'OpenAI',
    'generate_image': 'OpenAI',
  };

  // Manual descriptions since regex parsing is fragile
  const toolDescriptions: Record<string, string> = {
    'ahrefs_matching_terms': 'Get matching keyword terms for a seed keyword from Ahrefs Keywords Explorer',
    'ahrefs_serp_overview': 'Get SERP overview for a keyword showing top-ranking pages and their metrics',
    'ahrefs_domain_rating': 'Get domain rating and authority metrics for a domain',
    'ahrefs_organic_keywords': 'Get organic keywords ranking for a domain',
    'ahrefs_organic_pages': 'Get top organic pages for a domain',
    'ahrefs_backlinks_stats': 'Get backlink statistics for a domain',
    'ahrefs_competing_domains': 'Find competing domains in organic search',
    'ahrefs_keyword_difficulty': 'Get keyword difficulty scores for a list of keywords',
    'ahrefs_keyword_volume': 'Get search volume data for keywords',
    'ahrefs_related_keywords': 'Get related keywords for a seed keyword',
    'serper_search': 'Search Google via Serper API',
    'serper_search_batch': 'Batch search multiple queries via Serper API',
    'firecrawl_scrape': 'Scrape a single URL and extract content',
    'firecrawl_crawl': 'Crawl a website starting from a URL',
    'firecrawl_map_site': 'Get sitemap/URL structure of a website',
    'pagespeed_analyze': 'Run PageSpeed Insights analysis on a URL',
    'pagespeed_crux': 'Get Chrome UX Report (CrUX) data for an origin',
    'dataforseo_keyword_volume': 'Get search volume data for keywords via DataForSEO',
    'dataforseo_keyword_suggestions': 'Get keyword suggestions for a seed keyword',
    'dataforseo_keyword_difficulty': 'Get keyword difficulty scores via DataForSEO',
    'dataforseo_onpage_task': 'Create an on-page SEO analysis task',
    'dataforseo_onpage_summary': 'Get on-page analysis summary for a task',
    'dataforseo_backlinks_summary': 'Get backlinks summary for a domain via DataForSEO',
    'dataforseo_domain_technologies': 'Detect technologies used by a domain',
    'anthropic_ai_inference': 'Ask Claude a question and check if a brand appears in the AI response',
    'openai_ai_inference': 'Ask OpenAI a question and check if a brand appears in the AI response',
    'generate_image': 'Generate an image using gpt-image-1 from a text prompt',
  };

  for (const name of names) {
    const prefix = name.split('_')[0];
    const integration = integrationMap[prefix] || integrationMap[name] || 'Other';
    tools.push({
      name,
      description: toolDescriptions[name] || '',
      integration,
    });
  }

  return tools;
}

// ------- Assign phases -------
function assignPhase(stepKey: string): number {
  const phase1 = ['business-profile', 'seed-keywords', 'site-audit', 'ai-intelligence', 'serp-niche-map', 'competitor-buckets', 'competitor-metrics', 'search-demand', 'phase1-baseline'];
  const phase2 = ['method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import', 'consolidated-keywords'];
  const phase3 = ['verdict-strategy', 'topical-map'];
  const phase4 = ['content-brief', 'content-article', 'content-images'];

  if (phase1.includes(stepKey)) return 1;
  if (phase2.includes(stepKey)) return 2;
  if (phase3.includes(stepKey)) return 3;
  if (phase4.includes(stepKey)) return 4;
  return 0;
}

// ------- Pipeline API calls per step -------
interface PipelineCall {
  integration: string;
  method: string;
  endpoint: string;
  purpose: string;
  dataCollected: string;
  fedToAgent: string;
}

function getPipelineCalls(): Record<string, PipelineCall[]> {
  return {
    'business-profile': [
      { integration: 'Firecrawl', method: 'scrape(url)', endpoint: 'POST /v1/scrape', purpose: 'Scrape target domain pages (homepage, /about, /services, /about-us) to extract business signals', dataCollected: 'Markdown content, metadata, page structure for each URL', fedToAgent: 'rawData.scrapedPages[] — full page content for industry/positioning/brand analysis' },
      { integration: 'Ahrefs', method: 'getDomainRating(domain)', endpoint: 'GET /v3/site-explorer/domain-rating', purpose: 'Get domain authority score for baseline assessment', dataCollected: 'domain_rating (0-100), ahrefs_rank', fedToAgent: 'rawData.domainAuthority.domain_rating, ahrefs_rank' },
      { integration: 'Ahrefs', method: 'getBacklinksStats(domain)', endpoint: 'GET /v3/site-explorer/backlinks-stats', purpose: 'Get backlink profile size for authority assessment', dataCollected: 'Live backlinks count, referring domains count, all-time stats', fedToAgent: 'rawData.domainAuthority.referring_domains, backlinks' },
    ],
    'seed-keywords': [
      { integration: 'Ahrefs', method: 'getOrganicKeywords(domain, country, 50)', endpoint: 'GET /v3/site-explorer/organic-keywords', purpose: 'Fetch existing organic keyword rankings for the domain (top 50 by traffic)', dataCollected: 'Keywords with position, volume, difficulty, CPC, URL', fedToAgent: 'rawData.organicKeywords — existing rankings to assess current footprint' },
      { integration: 'Ahrefs', method: 'getOrganicKeywords(competitor, country, 20)', endpoint: 'GET /v3/site-explorer/organic-keywords', purpose: '[Fallback] If domain has 0 organic keywords, fetch from competitor domains', dataCollected: 'Competitor organic keywords as alternative seed source', fedToAgent: 'rawData.competitorOrganicKeywords[] — fallback seed evidence' },
      { integration: 'Ahrefs', method: 'getRelatedKeywords(seed, country)', endpoint: 'GET /v3/keywords-explorer/related-terms', purpose: 'Expand each seed keyword with semantically related terms', dataCollected: 'Related keyword suggestions with metrics', fedToAgent: 'rawData.relatedTerms[] — grouped by seed term' },
      { integration: 'DataForSEO', method: 'getKeywordSuggestions(seed, location)', endpoint: 'POST /v3/dataforseo_labs/keyword_suggestions/live', purpose: 'Get additional keyword suggestions from DataForSEO for broader coverage', dataCollected: 'Keyword suggestions with volume, CPC, competition', fedToAgent: 'rawData.suggestions[] — grouped by seed term' },
    ],
    'site-audit': [
      { integration: 'Firecrawl', method: 'mapSite(origin)', endpoint: 'POST /v1/map', purpose: 'Discover full site URL structure and page count', dataCollected: 'Array of all discoverable URLs on the domain', fedToAgent: 'rawData.siteMap — URL inventory for site structure analysis' },
      { integration: 'Firecrawl', method: 'crawl(origin, 20)', endpoint: 'POST /v1/crawl', purpose: 'Crawl up to 20 pages for content and technical signals', dataCollected: 'Markdown content, titles, descriptions, word counts per page', fedToAgent: 'rawData.crawledPages[] — page content for technical assessment' },
      { integration: 'PageSpeed', method: 'analyze(homepage, "mobile")', endpoint: 'GET /pagespeedonline/v5/runPagespeed', purpose: 'Run Lighthouse audit (mobile) for Core Web Vitals and performance scores', dataCollected: 'Performance/SEO/accessibility scores, FCP, LCP, CLS, TBT, top opportunities', fedToAgent: 'rawData.pagespeedMobile — mobile performance baseline' },
      { integration: 'PageSpeed', method: 'analyze(homepage, "desktop")', endpoint: 'GET /pagespeedonline/v5/runPagespeed', purpose: 'Run Lighthouse audit (desktop) for comparison with mobile', dataCollected: 'Same as mobile but for desktop viewport', fedToAgent: 'rawData.pagespeedDesktop — desktop performance baseline' },
      { integration: 'PageSpeed', method: 'getCruxData(origin)', endpoint: 'GET /pagespeedonline/v5/runPagespeed (CrUX)', purpose: 'Get real-user Chrome UX Report data (field metrics)', dataCollected: 'Real-world CWV: LCP, FID, CLS distributions from real users', fedToAgent: 'rawData.crux — field data for performance reality check' },
      { integration: 'DataForSEO', method: 'createOnPageTask(origin)', endpoint: 'POST /v3/on_page/task_post', purpose: 'Create on-page technical SEO analysis task', dataCollected: 'On-page crawl results: broken links, redirects, meta issues', fedToAgent: 'rawData.onPageSummary — technical issues inventory' },
    ],
    'ai-intelligence': [
      { integration: 'Firecrawl', method: 'scrape(homepage)', endpoint: 'POST /v1/scrape', purpose: 'Scrape homepage for schema markup, content structure, E-E-A-T signals', dataCollected: 'Full page markdown and metadata', fedToAgent: 'rawData.scrapedPages[0] — homepage content for citability analysis' },
      { integration: 'Firecrawl', method: 'scrape(secondPage)', endpoint: 'POST /v1/scrape', purpose: 'Scrape a secondary key page for deeper content quality assessment', dataCollected: 'Page content and structure signals', fedToAgent: 'rawData.scrapedPages[1] — secondary page for content depth analysis' },
      { integration: 'OpenAI', method: 'inferAiBrandMention(query, brand) ×5', endpoint: 'POST /v1/chat/completions', purpose: 'Test if AI (ChatGPT) mentions/recommends the brand in natural queries', dataCollected: 'AI response text, whether brand mentioned, position quality (featured/cited/listed/absent), context sentence', fedToAgent: 'rawData.aiMentions[] — 5 queries with ground-truth AI visibility data' },
      { integration: 'Serper', method: 'search("best [category] [market]")', endpoint: 'POST /search', purpose: 'Check SERP brand presence for category-level queries', dataCollected: 'Top 10 SERP results, featured snippets, PAA', fedToAgent: 'rawData.serpResults.best — competitive SERP landscape' },
      { integration: 'Serper', method: 'search("[brand] review")', endpoint: 'POST /search', purpose: 'Assess brand reputation signals in search results', dataCollected: 'Review-related SERP results', fedToAgent: 'rawData.serpResults.review — reputation SERP data' },
      { integration: 'Serper', method: 'search("[brand] vs [competitor]")', endpoint: 'POST /search', purpose: 'Evaluate comparison positioning in search', dataCollected: 'Comparison SERP results', fedToAgent: 'rawData.serpResults.vs — competitive comparison data' },
    ],
    'serp-niche-map': [
      { integration: 'Ahrefs', method: 'getSerpOverview(keyword, country) ×20', endpoint: 'GET /v3/keywords-explorer/serp-overview', purpose: 'Get SERP overview for each seed keyword (top 20) — shows who ranks, their DR, traffic', dataCollected: 'Top 10 ranking pages per keyword with domain, position, DR, traffic, backlinks', fedToAgent: 'rawData.serpResults[] — complete SERP landscape per keyword for niche mapping' },
    ],
    'competitor-buckets': [
      { integration: 'Ahrefs', method: 'getCompetingDomains(domain, country, 20)', endpoint: 'GET /v3/site-explorer/competing-domains', purpose: 'Find domains that share the most organic keywords with the target', dataCollected: 'Competing domains with keyword overlap count and common keywords', fedToAgent: 'rawData.competingDomains — organic competitors for bucketing' },
      { integration: 'Serper', method: 'search(service+industry) ×3', endpoint: 'POST /search', purpose: 'Corroborate Ahrefs competitors with SERP-visible competitors for service keywords', dataCollected: 'Top 10 SERP results per service query', fedToAgent: 'rawData.serperResults[] — SERP competitors for validation' },
    ],
    'competitor-metrics': [
      { integration: 'Ahrefs', method: 'getDomainRating(competitor) ×N', endpoint: 'GET /v3/site-explorer/domain-rating', purpose: 'Get authority score for each competitor (parallel per competitor)', dataCollected: 'Domain rating (0-100), Ahrefs rank per competitor', fedToAgent: 'competitorMetrics[].domainRating — authority comparison' },
      { integration: 'Ahrefs', method: 'getBacklinksStats(competitor) ×N', endpoint: 'GET /v3/site-explorer/backlinks-stats', purpose: 'Get backlink profile size for each competitor', dataCollected: 'Live backlinks, referring domains per competitor', fedToAgent: 'competitorMetrics[].backlinks — link profile comparison' },
      { integration: 'Ahrefs', method: 'getOrganicKeywords(competitor, country, 20) ×N', endpoint: 'GET /v3/site-explorer/organic-keywords', purpose: 'Get top-ranking keywords for each competitor', dataCollected: 'Top 20 organic keywords with position, volume, URL per competitor', fedToAgent: 'competitorMetrics[].topKeywords — keyword overlap analysis' },
    ],
    'search-demand': [
      { integration: 'DataForSEO', method: 'getKeywordSearchVolume(batch, location)', endpoint: 'POST /v3/keywords_data/google_ads/search_volume/live', purpose: 'Get accurate monthly search volume for all seed keywords (batched 50/chunk)', dataCollected: 'Monthly search volume, CPC, competition level per keyword', fedToAgent: 'Direct output (pipeline-only): enrichedKeywords[].metrics.searchVolume' },
      { integration: 'Ahrefs', method: 'getKeywordDifficulty(batch, country)', endpoint: 'GET /v3/keywords-explorer/keyword-difficulty', purpose: 'Get keyword difficulty scores (0-100) for all seed keywords (batched 50/chunk)', dataCollected: 'Keyword difficulty score per keyword', fedToAgent: 'Direct output (pipeline-only): enrichedKeywords[].metrics.keywordDifficulty' },
    ],
    'phase1-baseline': [
      { integration: 'Ahrefs', method: 'getOrganicPages(domain, country, 20)', endpoint: 'GET /v3/site-explorer/top-pages', purpose: 'Get top-performing pages for the target domain by organic traffic', dataCollected: 'Top 20 pages with URL, organic traffic, keywords count', fedToAgent: 'rawData.organicPages — current page performance for baseline assessment' },
    ],
    'method01-competitor-pages': [
      { integration: 'Ahrefs', method: 'getOrganicPages(competitor, country, 50) ×N', endpoint: 'GET /v3/site-explorer/top-pages', purpose: 'Get top organic pages from each competitor for content gap discovery', dataCollected: 'Top 50 pages per competitor with traffic, keywords, URL', fedToAgent: 'rawData.competitorPages[] — competitor content inventory for gap analysis' },
    ],
    'method02-seed-expansion': [
      // No API calls — reuses seed-keywords context data
    ],
    'method03-content-gap-import': [
      { integration: 'DataForSEO', method: 'getRankedKeywords(domain, country, "en", 500)', endpoint: 'POST /v3/dataforseo_labs/ranked_keywords/live', purpose: 'Get all ranked keywords for target domain (up to 500)', dataCollected: 'Full keyword rankings with position, volume, URL', fedToAgent: 'rawData.targetKeywords — target domain current keyword inventory' },
      { integration: 'DataForSEO', method: 'getRankedKeywords(competitor, country, "en", 200) ×N', endpoint: 'POST /v3/dataforseo_labs/ranked_keywords/live', purpose: 'Get ranked keywords for each competitor to find gaps', dataCollected: 'Competitor keyword rankings (up to 200 each)', fedToAgent: 'rawData.competitorKeywords[] — competitor keywords for gap calculation' },
    ],
    'consolidated-keywords': [
      // No API calls — pure TypeScript dedup/merge of all keyword sources
    ],
    'verdict-strategy': [
      // No API calls — agent-only, reasons over prior step outputs
    ],
    'topical-map': [
      // No API calls — agent-only, creates pillar/cluster structure from strategy
    ],
    'content-brief': [
      { integration: 'Serper', method: 'search(targetKeyword, country, 10)', endpoint: 'POST /search', purpose: 'Get current top 10 SERP results for the target content keyword', dataCollected: 'Top 10 organic results with titles, URLs, snippets, PAA questions', fedToAgent: 'rawData.serpResults — competitive content landscape' },
      { integration: 'Firecrawl', method: 'scrape(url) ×3', endpoint: 'POST /v1/scrape', purpose: 'Scrape top 3 ranking pages to analyze their content structure and depth', dataCollected: 'Full markdown content, headings, word count, structure', fedToAgent: 'rawData.scrapedPages[] — competitor content for brief benchmarking' },
    ],
    'content-article': [
      { integration: 'Serper', method: 'search("[keyword] statistics data [year]")', endpoint: 'POST /search', purpose: 'Find statistics and data sources for fact-checking in the article', dataCollected: 'Top 8 results with stats/data-focused content', fedToAgent: 'rawData.statsSearch — factual reference corpus' },
      { integration: 'Serper', method: 'search("[keyword] [year]", type: "news")', endpoint: 'POST /search (news)', purpose: 'Find recent news/developments for recency signals', dataCollected: 'Top 5 news results', fedToAgent: 'rawData.newsSearch — recency context for timely writing' },
      { integration: 'Serper', method: 'search("what is [keyword]")', endpoint: 'POST /search', purpose: 'Capture People Also Ask and reader questions for the topic', dataCollected: 'PAA questions, related searches', fedToAgent: 'rawData.paaSearch — reader questions to address in article' },
    ],
    'content-images': [
      { integration: 'OpenAI', method: 'generateImage(prompt)', endpoint: 'POST /v1/images/generations (gpt-image-1)', purpose: 'Generate custom images for the article based on detailed prompts', dataCollected: 'Base64-encoded PNG image, revised prompt', fedToAgent: 'Agent calls tool directly during execution (agent-with-tools)' },
    ],
  };
}

// ------- Build on-demand agents -------
function buildOnDemandAgents() {
  return [
    { id: 'od-content-refresh', name: 'Content Refresh Analyzer', type: 'content-refresh', credits: 5, description: 'Analyzes GSC keyword data (90d vs 180d) and keyword decay alerts to recommend content refreshes.' },
    { id: 'od-ai-search-visibility', name: 'AI Search Visibility Auditor', type: 'ai-search-visibility', credits: 5, description: 'Audits prompt visibility results, LLM traffic stats, and sessions by engine to assess AI search presence.' },
    { id: 'od-technical-issues', name: 'Technical Issues Summarizer', type: 'technical-issues', credits: 3, description: 'Summarizes LLM audit results including page crawlability, AI indexability, and trust signals.' },
    { id: 'od-keyword-opportunity', name: 'Keyword Opportunity Finder', type: 'keyword-opportunity', credits: 5, description: 'Identifies high-impression/low-CTR keywords, tracked prompts, and prompt visibility gaps.' },
    { id: 'od-google-vs-ai', name: 'Google vs AI Search Comparator', type: 'google-vs-ai', credits: 4, description: 'Compares GSC traffic with LLM traffic stats and sessions (30d vs 60d trends).' },
    { id: 'od-keyword-decay', name: 'Keyword Decay Monitor', type: 'keyword-decay', credits: 3, description: 'Monitors active keyword decay alerts with severity breakdown and trend analysis.' },
    { id: 'od-competitor-analysis', name: 'Competitor Analysis', type: 'competitor-analysis', credits: 5, description: 'Analyzes competitor citations in prompts, shared keywords, and prompt visibility.' },
  ];
}

// ------- Build integrations -------
function buildIntegrations() {
  return [
    { id: 'int-ahrefs', name: 'Ahrefs v3', category: 'SEO Data', methods: ['getDomainRating', 'getOrganicKeywords', 'getOrganicPages', 'getBacklinksStats', 'getCompetingDomains', 'getKeywordDifficulty', 'getKeywordVolume', 'getRelatedKeywords', 'getMatchingTerms', 'getSerpOverview'], baseUrl: 'https://api.ahrefs.com/v3' },
    { id: 'int-serper', name: 'Serper.dev', category: 'SERP Data', methods: ['search', 'searchBatch'], baseUrl: 'https://google.serper.dev' },
    { id: 'int-firecrawl', name: 'Firecrawl', category: 'Web Scraping', methods: ['scrape', 'crawl', 'mapSite', 'getCrawlStatus'], baseUrl: 'https://api.firecrawl.dev/v1' },
    { id: 'int-pagespeed', name: 'PageSpeed Insights', category: 'Performance', methods: ['analyze', 'getCruxData'], baseUrl: 'Google PageSpeed v5 API' },
    { id: 'int-dataforseo', name: 'DataForSEO', category: 'SEO Data', methods: ['getKeywordSearchVolume', 'getKeywordSuggestions', 'getKeywordDifficulty', 'createOnPageTask', 'getOnPageSummary', 'getBacklinksSummary', 'getDomainTechnologies'], baseUrl: 'https://api.dataforseo.com/v3' },
    { id: 'int-anthropic', name: 'Anthropic Claude', category: 'LLM', methods: ['chatCompletion', 'inferAiBrandMention'], baseUrl: 'Anthropic API' },
    { id: 'int-openai', name: 'OpenAI', category: 'LLM + Images', methods: ['chatCompletion', 'inferAiBrandMention', 'generateImage'], baseUrl: 'https://api.openai.com/v1' },
    { id: 'int-gsc', name: 'Google Search Console', category: 'Analytics', methods: ['getPerformance', 'getTopQueries', 'getTopPages'], baseUrl: 'Python Sidecar → GSC API' },
    { id: 'int-stripe', name: 'Stripe', category: 'Billing', methods: ['createCheckoutSession', 'createPortalSession', 'handleWebhook'], baseUrl: 'https://api.stripe.com' },
  ];
}

// ------- Build data stores -------
function buildDataStores() {
  return [
    { id: 'ds-keywords', name: 'Keywords Table', description: 'Discovered/curated keyword research data', writtenBy: ['seed-keywords', 'method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import', 'consolidated-keywords'], readBy: ['Frontend Keywords Dashboard', 'On-Demand Agents'] },
    { id: 'ds-topical-maps', name: 'Topical Maps Table', description: 'Content pillar structure with pillars and publishing calendar', writtenBy: ['topical-map'], readBy: ['Frontend Topical Map', 'content-brief'] },
    { id: 'ds-content-pieces', name: 'Content Pieces Table', description: 'Generated briefs and articles', writtenBy: ['content-brief', 'content-article'], readBy: ['Frontend Content Editor', 'content-images'] },
    { id: 'ds-content-images', name: 'Content Images Table', description: 'Generated images with alt text and prompts', writtenBy: ['content-images'], readBy: ['Frontend Content Editor'] },
    { id: 'ds-reports', name: 'Reports Table', description: 'Analytical reports (full strategy, AI visibility, keyword research, content plan)', writtenBy: ['Reports Service'], readBy: ['Frontend Reports Page'] },
    { id: 'ds-workflow-runs', name: 'Workflow Runs', description: 'Execution state for the 18-step pipeline', writtenBy: ['Workflow Service'], readBy: ['Frontend Workflow Shell'] },
    { id: 'ds-step-artifacts', name: 'Step Artifacts', description: 'Versioned JSON output from each agent step', writtenBy: ['All Pipeline Agents'], readBy: ['Workflow Materializer', 'Frontend Artifact Panel'] },
    { id: 'ds-credit-ledger', name: 'Credit Ledger', description: 'Audit trail of credit usage, purchases, refunds', writtenBy: ['Credits Service'], readBy: ['Frontend Credits Page'] },
  ];
}

// ------- Build infrastructure nodes -------
function buildInfrastructure() {
  return [
    { id: 'infra-bullmq', name: 'BullMQ Queue', description: 'Job queue for workflow step execution. Queue name: "workflow-steps". 3 retries with exponential backoff.' },
    { id: 'infra-redis', name: 'Redis', description: 'Job queue backend + caching. Port 6379.' },
    { id: 'infra-postgres', name: 'PostgreSQL', description: 'Primary database. Drizzle ORM. Port 5433.' },
    { id: 'infra-websocket', name: 'WebSocket Gateway', description: 'Real-time step progress events. Namespace: /workflows. Events: step:started, step:completed, step:failed, workflow:completed.' },
    { id: 'infra-clerk', name: 'Clerk Auth', description: 'Authentication provider. JWT validation, org membership, webhooks.' },
  ];
}

// ------- Build frontend features -------
function buildFrontendFeatures() {
  return [
    { id: 'fe-workflow', name: 'Workflow Shell', description: 'Real-time pipeline execution UI with step rail, progress bar, artifact panel, reasoning panel, and tool call trail.' },
    { id: 'fe-content', name: 'Content Editor', description: 'Content piece editor/viewer with draft/review/approved status management.' },
    { id: 'fe-keywords', name: 'Keywords Dashboard', description: 'Keyword research dashboard with filtering, status management, and bulk operations.' },
    { id: 'fe-topical-map', name: 'Topical Map', description: 'Visual topical map editor showing pillar/cluster hierarchy.' },
    { id: 'fe-reports', name: 'Reports', description: 'Report generation and download UI for 4 report types.' },
    { id: 'fe-billing', name: 'Billing & Credits', description: 'Stripe checkout, subscription management, credit balance and transactions.' },
    { id: 'fe-llm-traffic', name: 'LLM Traffic Analytics', description: 'Dashboard showing AI engine visits, sessions, and trends.' },
    { id: 'fe-prompt-vis', name: 'Prompt Visibility', description: 'Track brand visibility across AI search engines for custom prompts.' },
  ];
}

// ------- Build edges -------
function buildEdges(agents: ReturnType<typeof parseAgentDefinitions>, tools: ReturnType<typeof parseTools>) {
  const edges: { source: string; target: string; type: string; label?: string }[] = [];

  // Dependency edges between agents
  for (const agent of agents) {
    for (const dep of agent.dependsOn) {
      edges.push({ source: dep, target: agent.stepKey, type: 'dependency', label: 'depends on' });
    }
  }

  // Tool usage edges (agent → integration)
  const toolToIntegration: Record<string, string> = {};
  for (const tool of tools) {
    const prefix = tool.name.split('_')[0];
    const map: Record<string, string> = {
      'ahrefs': 'int-ahrefs', 'serper': 'int-serper', 'firecrawl': 'int-firecrawl',
      'pagespeed': 'int-pagespeed', 'dataforseo': 'int-dataforseo',
      'anthropic': 'int-anthropic', 'openai': 'int-openai', 'generate': 'int-openai',
    };
    toolToIntegration[tool.name] = map[prefix] || 'int-openai';
  }

  for (const agent of agents) {
    for (const toolName of agent.tools) {
      const intId = toolToIntegration[toolName];
      if (intId) {
        edges.push({ source: agent.stepKey, target: intId, type: 'api-call', label: toolName });
      }
    }
  }

  // Materialization edges (agent → data store)
  const materializationMap: Record<string, string> = {
    'seed-keywords': 'ds-keywords',
    'method01-competitor-pages': 'ds-keywords',
    'method02-seed-expansion': 'ds-keywords',
    'consolidated-keywords': 'ds-keywords',
    'topical-map': 'ds-topical-maps',
    'content-brief': 'ds-content-pieces',
    'content-article': 'ds-content-pieces',
    'content-images': 'ds-content-images',
  };

  for (const [stepKey, dsId] of Object.entries(materializationMap)) {
    edges.push({ source: stepKey, target: dsId, type: 'materialization', label: 'writes to' });
  }

  // Infrastructure edges
  edges.push({ source: 'infra-bullmq', target: 'infra-redis', type: 'infra', label: 'backed by' });

  return edges;
}

// ------- Main -------
function main() {
  console.log('Generating architecture map data...');

  const agents = parseAgentDefinitions();
  const prompts = parsePromptFiles();
  const skills = parseSkillFiles();
  const tools = parseTools();
  const edges = buildEdges(agents, tools);

  // Enrich agents with prompts, skills, and pipeline calls
  const pipelineCalls = getPipelineCalls();
  const enrichedAgents = agents.map(agent => ({
    ...agent,
    id: agent.stepKey,
    phase: assignPhase(agent.stepKey),
    prompt: prompts[agent.stepKey] || null,
    skillSummary: agent.skill ? (skills[agent.skill] || null) : null,
    pipelineCalls: pipelineCalls[agent.stepKey] || [],
  }));

  const data = {
    generatedAt: new Date().toISOString(),
    pipeline: {
      agents: enrichedAgents,
      phases: [
        { number: 1, name: 'Discovery & Analysis', description: 'Parallel analysis of business profile, keywords, competitors, and site health' },
        { number: 2, name: 'Keyword Research Methods', description: 'Three parallel research methods converging into a consolidated keyword list' },
        { number: 3, name: 'Strategy & Architecture', description: 'Strategic verdict and topical map architecture' },
        { number: 4, name: 'Content Generation', description: 'Brief creation, article writing, and image generation' },
      ],
    },
    onDemandAgents: buildOnDemandAgents(),
    integrations: buildIntegrations(),
    tools,
    dataStores: buildDataStores(),
    infrastructure: buildInfrastructure(),
    frontendFeatures: buildFrontendFeatures(),
    edges,
  };

  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, 'data.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Written to ${outputPath}`);
  console.log(`  - ${enrichedAgents.length} pipeline agents`);
  console.log(`  - ${data.onDemandAgents.length} on-demand agents`);
  console.log(`  - ${tools.length} tools`);
  console.log(`  - ${edges.length} edges`);
  console.log(`  - ${Object.keys(prompts).length} prompts loaded`);
  console.log(`  - ${Object.keys(skills).length} skills loaded`);

  // Build standalone HTML by embedding JSON into template
  const templatePath = path.join(OUTPUT_DIR, 'template.html');
  if (fs.existsSync(templatePath)) {
    const template = fs.readFileSync(templatePath, 'utf-8');
    const htmlOutput = template.replace(
      '__DATA_PLACEHOLDER__',
      JSON.stringify(data),
    );
    const htmlPath = path.join(OUTPUT_DIR, 'index.html');
    fs.writeFileSync(htmlPath, htmlOutput, 'utf-8');
    console.log(`✓ Standalone HTML written to ${htmlPath}`);
  } else {
    console.warn('⚠ template.html not found — skipping HTML generation');
  }
}

main();
