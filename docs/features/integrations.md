# Feature: Integrations

## Overview

Pulse integrates with 8 external services for SEO data, web scraping, AI processing, and authentication. All integrations follow the same pattern: a NestJS injectable service wrapping HTTP calls with retry logic.

## Integration Services

### OpenAI (`server/src/features/integrations/openai/openai.service.ts`)

| Method | Description |
|--------|-------------|
| `chatCompletion()` | Core LLM call with function calling support |

- **Model**: GPT-4o (configurable per agent)
- **Auth**: Bearer token via `OPENAI_API_KEY`
- **Retry**: Built-in retry for 429 (rate limit) and 5xx responses
- **Used by**: `OpenAiProvider` (via LlmProvider interface)

### Anthropic (`server/src/features/integrations/anthropic/anthropic.service.ts`)

| Method | Description |
|--------|-------------|
| `chat(options)` | Messages API with extended thinking + tool use support |

- **Model**: Claude Opus (`claude-opus-4-20250514`) — configurable
- **Auth**: API key via `ANTHROPIC_API_KEY`
- **Retry**: 3 attempts with exponential backoff for 429/5xx
- **Extended Thinking**: Budget configurable per call (default: 32K tokens for Tier 2)
- **Used by**: `AnthropicProvider` (via LlmProvider interface)
- **Env vars**: `ANTHROPIC_API_KEY`, `ANTHROPIC_DEFAULT_MODEL`

### Ahrefs v3 (`server/src/features/integrations/ahrefs/ahrefs.service.ts`)

| Method | Description |
|--------|-------------|
| `getDomainRating(domain)` | Domain authority score |
| `getOrganicKeywords(domain, country, limit)` | Organic keyword rankings |
| `getOrganicPages(domain, country, limit)` | Top-performing pages |
| `getBacklinksStats(domain)` | Backlink profile summary |
| `getCompetingDomains(domain, country, limit)` | Competitor identification |
| `getKeywordDifficulty(keywords[], country)` | KD scores |
| `getKeywordVolume(keywords[], country)` | Search volume data |
| `getRelatedKeywords(keyword, country, limit)` | Related term expansion |
| `getSerpOverview(keyword, country)` | SERP overview positions for a keyword |
| `getBrandMentions(domain, limit)` | Brand radar mentions |

- **Base URL**: `https://api.ahrefs.com/v3`
- **Auth**: Bearer token via `AHREFS_API_KEY`
- **Timeout**: 30s per request
- **Retry**: 3 attempts with exponential backoff via `withRetry()`
- **SERP Overview**: Uses `GET /v3/serp-overview/serp-overview` with `keyword`, `country`, `select`, and `top_positions` params

### DataForSEO (`server/src/features/integrations/dataforseo/dataforseo.service.ts`)

| Method | Description |
|--------|-------------|
| `getSerpResults(keyword, location, language)` | Live SERP results |
| `getKeywordSearchVolume(keywords[], location, language)` | Volume data |
| `getKeywordSuggestions(keyword, location, language, limit)` | Keyword ideas |
| `getKeywordDifficulty(keywords[], location, language)` | KD with relevance |
| `createOnPageTask(url)` | Start on-page audit crawl |
| `getOnPageSummary(taskId)` | Audit summary results |
| `getOnPagePages(taskId, limit)` | Audit page-level results |
| `getBacklinksSummary(domain)` | Backlink profile |
| `getDomainTechnologies(domain)` | Technology stack detection |

- **Base URL**: `https://api.dataforseo.com/v3`
- **Auth**: Basic auth via `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD`
- **Timeout**: 30s per request
- **Retry**: 3 attempts with exponential backoff

### Serper.dev (`server/src/features/integrations/serper/serper.service.ts`)

| Method | Description |
|--------|-------------|
| `search(options)` | Google SERP results (search, news, images, places) |
| `searchBatch(queries[], country)` | Sequential batch search |

- **Base URL**: `https://google.serper.dev`
- **Auth**: `X-API-KEY` header via `SERPER_API_KEY`
- **Timeout**: 30s per request
- **Retry**: 3 attempts with exponential backoff

### Firecrawl (`server/src/features/integrations/firecrawl/firecrawl.service.ts`)

| Method | Description |
|--------|-------------|
| `scrape(url, options)` | Single page scrape (markdown, HTML, screenshot) |
| `crawl(url, limit)` | Multi-page crawl |
| `getCrawlStatus(crawlId)` | Check async crawl status |
| `mapSite(url)` | Site map generation |

- **Base URL**: `https://api.firecrawl.dev/v1`
- **Auth**: Bearer token via `FIRECRAWL_API_KEY`
- **Timeout**: 60s for POST, 30s for GET
- **Retry**: 3 attempts with exponential backoff

### PageSpeed Insights (`server/src/features/integrations/pagespeed/pagespeed.service.ts`)

| Method | Description |
|--------|-------------|
| `analyze(url, strategy)` | Core Web Vitals & performance score |
| `getCruxData(origin)` | Chrome UX Report real-user metrics |

- **APIs**: Google PageSpeed Insights + CrUX
- **Auth**: API key via `PAGESPEED_API_KEY` (optional for PageSpeed, required for CrUX)
- **Timeout**: 60s for PageSpeed, 30s for CrUX
- **Retry**: 3 attempts with exponential backoff

### Google Search Console (`server/src/features/integrations/gsc/gsc.service.ts`)

| Method | Description |
|--------|-------------|
| `getAuthUrl(state)` | Generate Google OAuth consent screen URL |
| `exchangeCode(code)` | Exchange authorization code for tokens |
| `refreshAccessToken(encryptedRefreshToken)` | Refresh expired access token |
| `saveConnection(params)` | Upsert GSC connection with encrypted tokens |
| `getConnection(projectId)` | Get connection record for a project |
| `pullSearchAnalytics(params)` | Query Google Search Analytics API directly |
| `storeKeywordData(connectionId, projectId, rows)` | Batch-insert keyword data (500/batch) |
| `getPerformanceSummary(projectId, startDate, endDate)` | Aggregated performance metrics |
| `getKeywords(projectId, params)` | Query stored keyword data |

- **API**: Google Search Console (webmasters/v3) — direct OAuth2
- **Auth**: OAuth2 with offline access; tokens encrypted at rest via AES-256-GCM
- **Env vars**: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REDIRECT_URI`, `GSC_ENCRYPTION_KEY` (32-byte hex)
- **Storage**: `gscConnections` (per-project, upsert on projectId), `gscKeywordData` (time-series)
- **Sync**: BullMQ `gsc-sync` queue — daily pull + historical on first connect
- **Controller**: `gsc.controller.ts` — routes under `/projects/:projectId/gsc/`
  - `GET /connect` → redirects to Google OAuth
  - `GET /callback` → exchanges code, saves connection, redirects to frontend
  - `GET /status` → connection status
  - `GET /keywords` → stored keyword data (query params: startDate, endDate, limit)
  - `GET /summary` → aggregated performance (last 28 days default)

### Clerk (`server/src/features/auth/`)

| Component | Description |
|-----------|-------------|
| `clerk.guard.ts` | JWT verification guard for all API endpoints |
| `org-membership.guard.ts` | Organization membership authorization |
| `auth.controller.ts` | Webhook handler for org/membership events |
| `auth.service.ts` | Processes Clerk webhook payloads (idempotent inserts) |

- **Auth**: JWT verification via `CLERK_SECRET_KEY`, Svix webhook verification via `CLERK_WEBHOOK_SECRET`
- **Webhook events handled**: `organization.created`, `organizationMembership.created`
- **Idempotency**: `onConflictDoNothing()` on both org and member inserts

## Shared Retry Utility

All integration services (except OpenAI which has its own) use:

```typescript
// server/src/shared/utils/retry.ts
withRetry(fn, { attempts: 3, delayMs: 1000, label: 'operation' })
```

- **Default attempts**: 3
- **Backoff**: Exponential (1s → 2s → 4s)
- **Logging**: Warns on retry, throws on final failure

## Tool Registry

Integration service methods are exposed to agents via the `ToolRegistry` (`server/src/agents/tool.registry.ts`). Each tool has a name, description, JSON schema for parameters, and an executor function that calls the corresponding service method.

Tools are bootstrapped in `server/src/agents/tool.bootstrap.ts` on application startup and registered under names like:
- `ahrefs_domain_rating`
- `ahrefs_organic_keywords`
- `dataforseo_serp_results`
- `serper_search`
- `firecrawl_scrape`
- `pagespeed_analyze`

Agents reference tools by name in their `.agent.md` YAML frontmatter `tools:` array.
