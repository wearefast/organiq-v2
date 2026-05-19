# Platform Enhancement Specification
> Copilot Prompt Document — SEO & AI Search Platform Upgrade
> Based on competitive gap analysis vs. Atomic AGI

---

## Context: What This Platform Already Does

This is an SEO audit and content generation platform built around a structured keyword research workflow. The existing feature set covers:

1. **AI Business Profile Generation** — Analyze a client website URL and output brand identity, target market, tone of voice, operational model, services, and geographic focus.
2. **Seed Keyword Extraction** — Identify core keywords, money keywords, and niche entities from the business profile.
3. **Competitor Discovery** — Find direct competitors (same service, market, geo) and organic competitors (authority content, related topics) via SERP analysis of seed keywords.
4. **Topical Map Builder** — Build Pillar + Cluster content architecture tagged by funnel stage (TOFU / MOFU / BOFU) using three methods: Competitor Top Pages, Seed Keyword Expansion, and Content Gap Analysis.
5. **Keyword Sheet Output** — Structured sheet with Primary Keyword, KD, Search Volume, Intent, Target URL, and LSI Keywords — organized by intent category (Transactional, Commercial, Discovery, Informational, Programmatic, Seasonal, Vertical).
6. **Content Generation** — Generate SEO-optimized content for target pages based on the keyword research.
7. **SEO Audit** — Crawl and audit websites for technical SEO issues.

**Tech stack context:** [Insert your stack — e.g., Next.js, Node.js, PostgreSQL, etc.]

**Data integrations already connected:** [List existing — e.g., Ahrefs API, OpenAI API, etc.]

---

## What We Are Building Now

We are adding three new capability layers to close the gap with the current best-in-class AI-era SEO platform (Atomic AGI). These are:

1. **AI Search Intelligence** — Track brand visibility inside LLMs (ChatGPT, Perplexity, Gemini, Claude, Copilot, etc.)
2. **SEO Analytics Dashboard** — Connect Google Search Console + GA4 for performance tracking and conversion attribution
3. **AI Agents & Workflow Automation** — Data-grounded agents that analyze and execute SEO tasks automatically

Each module is specified below with data models, API logic, UI components, and implementation notes. Build each module independently — they share a common project/website entity but are otherwise decoupled.

---

---

# MODULE 1 — AI Search Intelligence

> **Purpose:** Make LLM traffic visible and actionable. Track how brands appear inside AI search engines as a first-class analytics channel — not a secondary report.

---

## 1.1 LLM Traffic Tracking

### What It Does
Identify and attribute website visits that originate from AI search engines (ChatGPT, Perplexity, Gemini, Claude, Copilot, Grok, DeepSeek, etc.) — separate from Google organic traffic. Show volume, conversions, and engagement by AI engine.

### How It Works
AI search engines send referral traffic with recognizable referrer strings. Parse `document.referrer` or server-side request headers to identify AI engine sources. Map referrer domains to engine names.

**Known LLM referrer domains to detect:**
```
chatgpt.com, chat.openai.com       → ChatGPT
perplexity.ai                      → Perplexity
gemini.google.com, bard.google.com → Gemini
claude.ai                          → Claude
copilot.microsoft.com, bing.com    → Copilot
grok.x.com                         → Grok
deepseek.com                       → DeepSeek
you.com                            → You.com
phind.com                          → Phind
```

### Data Model

```sql
-- LLM Traffic Sessions
CREATE TABLE llm_traffic_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  ai_engine       VARCHAR(50) NOT NULL,        -- 'chatgpt' | 'perplexity' | 'gemini' | 'claude' | 'copilot' | 'grok' | 'deepseek'
  landing_page    TEXT NOT NULL,               -- URL path visited
  referrer_raw    TEXT,                        -- raw referrer string
  session_start   TIMESTAMPTZ NOT NULL,
  session_end     TIMESTAMPTZ,
  duration_secs   INTEGER,
  converted       BOOLEAN DEFAULT false,
  conversion_type VARCHAR(50),                 -- 'signup' | 'purchase' | 'download' | 'contact' | custom
  country         VARCHAR(2),
  device_type     VARCHAR(20),                 -- 'desktop' | 'mobile' | 'tablet'
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Aggregated LLM Stats (pre-computed, refresh hourly)
CREATE TABLE llm_traffic_stats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  ai_engine       VARCHAR(50) NOT NULL,
  date            DATE NOT NULL,
  total_sessions  INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  avg_duration_secs INTEGER DEFAULT 0,
  UNIQUE (project_id, ai_engine, date)
);
```

### API Endpoints

```
GET  /api/projects/:projectId/llm-traffic
     Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&engine=chatgpt
     Returns: { engines: [{ name, sessions, conversions, convRate, avgDuration, trend }] }

GET  /api/projects/:projectId/llm-traffic/pages
     Returns: top landing pages receiving LLM traffic with session counts

POST /api/projects/:projectId/llm-traffic/ingest
     Body: { referrer, landingPage, sessionId, timestamp }
     Internal endpoint called by tracking script
```

### Tracking Script
Generate a lightweight JS snippet (< 2kb) for clients to embed. It should:
- On page load: detect referrer, if matches LLM domain list → POST session start to ingest endpoint
- On page unload/visibilitychange: POST session end with duration
- On conversion event (configurable): POST conversion signal

```javascript
// Skeleton for the tracking snippet
(function() {
  const LLM_REFERRERS = {
    'chatgpt.com': 'chatgpt',
    'chat.openai.com': 'chatgpt',
    'perplexity.ai': 'perplexity',
    'gemini.google.com': 'gemini',
    'claude.ai': 'claude',
    'copilot.microsoft.com': 'copilot',
    'grok.x.com': 'grok',
    'deepseek.com': 'deepseek',
  };
  const referrer = document.referrer;
  const engine = Object.entries(LLM_REFERRERS).find(([domain]) => referrer.includes(domain))?.[1];
  if (!engine) return;
  // POST to ingest endpoint with engine, landingPage, sessionId
})();
```

### UI Components

**`<LLMTrafficOverview />`**
- Row of engine cards: icon, name, session count, conversion count, avg session time, trend arrow (vs. prev period)
- Time range selector: 7d / 30d / 90d / custom
- Bar chart: sessions by engine over time (recharts `BarChart`)

**`<LLMTrafficTable />`**
- Sortable table: Engine | Sessions | Conversions | Conv. Rate | Avg. Duration | Change
- Clickable rows → drill into engine-specific page breakdown

---

## 1.2 Prompt Visibility Tracking

### What It Does
Track specific "prompts" (queries) that users type into AI search engines and measure whether the client's brand appears in the response — and at what position. This is the GEO (Generative Engine Optimization) equivalent of keyword rank tracking.

### How It Works
1. User adds "tracked prompts" to the platform (e.g., "best SEO tool for SaaS companies")
2. Platform automatically queries each configured AI engine API with that prompt on a scheduled basis (every 24–72h depending on plan)
3. Parse the AI response: does the client's brand/domain appear? At what position? What context?
4. Store result, compute visibility % and avg position over time

### Prompt Querying Logic

```javascript
// For each tracked prompt, query AI engines via their APIs
async function queryAIEngine(engine, prompt, clientDomain) {
  let response;
  
  switch (engine) {
    case 'perplexity':
      // Use Perplexity API (sonar models support web search)
      response = await queryPerplexityAPI(prompt);
      break;
    case 'openai':
      // Use OpenAI API with web search tool enabled
      response = await queryOpenAIWithSearch(prompt);
      break;
    // etc.
  }

  return parseVisibility(response.text, clientDomain);
}

function parseVisibility(responseText, domain) {
  // Check if domain or brand name appears in response
  // Determine position (1st mention, 2nd mention, etc.)
  // Extract surrounding context (sentence where brand appears)
  // Return: { mentioned: bool, position: int|null, context: string, sentiment: 'positive'|'neutral'|'negative' }
}
```

### Data Model

```sql
-- Tracked Prompts
CREATE TABLE tracked_prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  prompt_text     TEXT NOT NULL,
  intent_stage    VARCHAR(20),                 -- 'awareness' | 'consideration' | 'decision'
  engines         TEXT[] DEFAULT '{}',         -- which engines to track this on
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Prompt Visibility Results
CREATE TABLE prompt_visibility_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id       UUID NOT NULL REFERENCES tracked_prompts(id),
  project_id      UUID NOT NULL REFERENCES projects(id),
  ai_engine       VARCHAR(50) NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL,
  brand_mentioned BOOLEAN NOT NULL,
  mention_position INTEGER,                    -- 1 = first brand mentioned, 2 = second, etc.
  response_excerpt TEXT,                       -- sentence(s) where brand appears
  competitor_mentions JSONB,                   -- [{ brand, position, domain }]
  visibility_pct  DECIMAL(5,2),               -- rolling calc: % of last N checks where brand appeared
  sentiment       VARCHAR(20)                  -- 'positive' | 'neutral' | 'negative'
);
```

### API Endpoints

```
GET  /api/projects/:projectId/prompts
     Returns: list of tracked prompts with latest visibility stats

POST /api/projects/:projectId/prompts
     Body: { promptText, intentStage, engines[] }
     Creates a new tracked prompt

GET  /api/projects/:projectId/prompts/:promptId/history
     Returns: visibility trend over time per engine

POST /api/internal/prompts/check
     Cron job endpoint: iterate all active prompts, run AI engine queries, store results
```

### UI Components

**`<PromptTracker />`**
- Add prompt form with intent stage selector and engine multi-select
- Prompt list table: Prompt | Intent | Visibility % | Avg Position | Engines | Last Checked
- Clicking a prompt → drawer showing trend chart + recent response excerpts

**`<PromptVisibilityChart />`**
- Line chart showing visibility % over time for a prompt (recharts `LineChart`)
- One line per AI engine, color coded

---

## 1.3 AI Brand Visibility Score

### What It Does
Aggregate all prompt tracking results into a single score representing how visible the brand is across all AI engines. Show citation share, position distribution, and trend.

### Calculation

```javascript
function calculateVisibilityScore(promptResults) {
  // visibilityPct = (prompts where brand mentioned / total prompts checked) * 100
  // avgPosition = mean of all mention_position values where brand_mentioned = true
  // citationShare = brand mentions / total entity mentions across all responses
  return { visibilityPct, avgPosition, citationShare, trend };
}
```

### UI Components

**`<BrandVisibilityScore />`**
- Large score display (0–100) with trend vs. last period
- Breakdown bar: visibility % by engine (ChatGPT 72% | Perplexity 58% | Gemini 41% | etc.)
- Position distribution donut: % mentioned 1st / 2nd / 3rd / 4th+ in AI responses

---

## 1.4 AI Brand Sentiment Analysis

### What It Does
Analyze the tone and context of AI responses that mention the client's brand. Surface recurring positive/negative themes and link them to source content that influences AI sentiment.

### Implementation

Run sentiment analysis on each `response_excerpt` stored in `prompt_visibility_results`.
Use an LLM call (cheapest model, e.g., GPT-4o-mini) with this prompt:

```
Classify the sentiment of this AI engine response excerpt about [brand]: 
"[excerpt]"

Return JSON: { sentiment: "positive"|"neutral"|"negative", themes: ["theme1","theme2"], confidence: 0-1 }
```

Aggregate themes across all results to surface the top recurring positive/negative patterns.

### Data Model
Add columns to `prompt_visibility_results`:
```sql
ALTER TABLE prompt_visibility_results
  ADD COLUMN sentiment_score VARCHAR(20),     -- 'positive' | 'neutral' | 'negative'
  ADD COLUMN sentiment_themes TEXT[],         -- ['reliable', 'expensive', 'easy to use']
  ADD COLUMN sentiment_confidence DECIMAL(3,2);
```

### UI Components

**`<SentimentDashboard />`**
- Positive % vs Negative % gauge
- Theme cloud: top positive themes (green) + top negative themes (red)
- Recent mention feed: excerpt cards tagged with sentiment label

---

## 1.5 AI Citations Analysis

### What It Does
Track which specific pages and domains AI engines cite as authoritative sources when responding to tracked prompts. Show citation share broken down by: Your Brand / Competitor / UGC / Corporate / Reference.

### Data Model

```sql
CREATE TABLE ai_citations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id       UUID NOT NULL REFERENCES prompt_visibility_results(id),
  project_id      UUID NOT NULL REFERENCES projects(id),
  cited_url       TEXT NOT NULL,
  cited_domain    TEXT NOT NULL,
  citation_type   VARCHAR(20) NOT NULL,        -- 'own' | 'competitor' | 'ugc' | 'corporate' | 'reference'
  position        INTEGER,                     -- order cited in response
  ai_engine       VARCHAR(50) NOT NULL,
  checked_at      TIMESTAMPTZ NOT NULL
);
```

### UI Components

**`<CitationsTable />`**
- Table: Domain | Citation Type | Frequency | Avg Position | Share %
- Filter by: own / competitor / ugc / corporate / reference
- Trend chart showing citation share over time per domain

---

---

# MODULE 2 — SEO Analytics Dashboard

> **Purpose:** Replace the need for Google Search Console's native UI with a purpose-built performance dashboard that connects keyword performance directly to content strategy decisions and conversion outcomes.

---

## 2.1 Google Search Console Integration

### What It Does
Connect GSC via OAuth to pull keyword rankings, impressions, clicks, CTR, and average position. This is the foundational data source for all SEO analytics.

### Integration Steps

1. Add Google OAuth 2.0 flow to the project settings
2. Request scopes: `https://www.googleapis.com/auth/webmasters.readonly`
3. Store OAuth tokens per project (refresh token securely encrypted)
4. On connection, pull 16 months of historical data via GSC Search Analytics API
5. Schedule daily sync (pull last 3 days to catch GSC's data delay)

**GSC API call pattern:**
```javascript
// Pull keyword performance
const response = await googleSearchConsole.searchanalytics.query({
  siteUrl: project.gscSiteUrl,
  requestBody: {
    startDate: '2024-01-01',
    endDate: '2025-05-18',
    dimensions: ['query', 'page', 'country', 'device', 'date'],
    rowLimit: 25000,
  }
});
```

### Data Model

```sql
CREATE TABLE gsc_keyword_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  date            DATE NOT NULL,
  keyword         TEXT NOT NULL,
  page            TEXT NOT NULL,
  country         VARCHAR(2),
  device          VARCHAR(20),
  clicks          INTEGER DEFAULT 0,
  impressions     INTEGER DEFAULT 0,
  ctr             DECIMAL(6,4),
  avg_position    DECIMAL(6,2),
  UNIQUE (project_id, date, keyword, page, country, device)
);

-- Indexed for performance
CREATE INDEX idx_gsc_project_date ON gsc_keyword_data(project_id, date);
CREATE INDEX idx_gsc_keyword ON gsc_keyword_data(project_id, keyword);
```

### API Endpoints

```
POST /api/projects/:projectId/integrations/gsc/connect
     Initiates OAuth flow

GET  /api/projects/:projectId/gsc/keywords
     Query: ?from&to&limit&sort&device&country
     Returns: keyword list with clicks, impressions, position, CTR, change vs prev period

GET  /api/projects/:projectId/gsc/pages
     Returns: landing page performance with same metrics

GET  /api/projects/:projectId/gsc/summary
     Returns: top-level totals + position tier breakdown (top3 / 4-10 / 11-50 / 51+)
```

---

## 2.2 Keyword Performance Dashboard

### What It Does
Show all keywords driving organic traffic with position tier segmentation, trend visualization, and filtering by branded/non-branded.

### UI Components

**`<KeywordDashboard />`**
- **Position tier summary bar:** [Top 3: N] [4–10: N] [11–50: N] [51+: N] — clickable filters
- **Trend chart:** Total clicks + impressions over time (dual-axis `LineChart`)
- **Keyword table:** Keyword | Position | Clicks | Impressions | CTR | Δ Position | Intent tag
  - Filterable by: position tier, branded/non-branded, device, country
  - Sortable by any column
  - Inline sparkline for position trend (last 30 days)
- **Branded vs Non-branded toggle** — detect branded by checking if keyword contains company name/domain

---

## 2.3 Landing Page Performance

### What It Does
Show which pages receive organic traffic with per-page metrics, impression-to-click ratio analysis (identifies high-impression / low-CTR optimization targets), and content health indicators.

### UI Components

**`<PagePerformance />`**
- Table: Page URL | Clicks | Impressions | CTR | Avg Position | Opportunity Score
- **Opportunity Score** = high impressions + low CTR → flag for title/meta optimization
- Click-through to page detail: shows keywords ranking for that specific URL
- Link to content editor if that page has a generated content record in the platform

---

## 2.4 Conversion Attribution

### What It Does
Connect organic traffic sessions to actual conversion events (signups, purchases, downloads) and attribute them to their source: Google Organic, ChatGPT, Perplexity, Direct, etc. This closes the loop between SEO investment and business outcomes.

### Implementation

Add a lightweight attribution script that:
1. On first visit: capture UTM params or referrer → store in `localStorage` as `first_touch_source`
2. On conversion event (form submit, checkout, CTA click): read `first_touch_source` → POST attribution record

```sql
CREATE TABLE conversion_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  session_id      TEXT NOT NULL,
  source_channel  VARCHAR(50),                 -- 'google_organic' | 'chatgpt' | 'perplexity' | 'direct' | 'referral'
  source_detail   TEXT,                        -- specific keyword or referrer
  landing_page    TEXT,
  conversion_type VARCHAR(50),                 -- 'signup' | 'purchase' | 'contact' | 'download'
  conversion_value DECIMAL(10,2),             -- optional monetary value
  converted_at    TIMESTAMPTZ NOT NULL,
  country         VARCHAR(2),
  device_type     VARCHAR(20)
);
```

### UI Components

**`<AttributionDashboard />`**
- **Source breakdown table:** Channel | Sessions | Conversions | Conv. Rate | Avg Time on Site
- **Funnel chart:** Visits → Engaged → Converted, broken down by channel
- LLM channels (ChatGPT, Perplexity, etc.) displayed alongside Google Organic for direct comparison
- Time range selector with period-over-period comparison

---

## 2.5 Geographic & Device Breakdown

### What It Does
Show traffic split by country (heatmap) and device type (bar chart). Helps identify localization opportunities and mobile optimization priorities.

### UI Components

**`<GeoTraffic />`** — country table with clicks, impressions, position, conversions

**`<DeviceBreakdown />`** — desktop / mobile / tablet split with performance metrics per device

---

---

# MODULE 3 — Technical SEO Enhancements

> **Purpose:** Extend the existing SEO audit with two new audit types that directly impact AI-era visibility: LLM crawlability and internal link structure.

---

## 3.1 LLM Crawlability Audit

### What It Does
Audit the client's website from the perspective of LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) — checking if they're allowed access, if the content structure is AI-readable, and if trust signals are in place.

### Audit Checks to Implement

**A. Bot Permission Checks (robots.txt)**
```javascript
async function checkLLMBotPermissions(siteUrl) {
  const robotsTxt = await fetch(`${siteUrl}/robots.txt`).then(r => r.text());
  const bots = {
    GPTBot: checkBotAllowed(robotsTxt, 'GPTBot'),
    ClaudeBot: checkBotAllowed(robotsTxt, 'ClaudeBot'),
    PerplexityBot: checkBotAllowed(robotsTxt, 'PerplexityBot'),
    'Google-Extended': checkBotAllowed(robotsTxt, 'Google-Extended'),
    Applebot: checkBotAllowed(robotsTxt, 'Applebot'),
    cohere: checkBotAllowed(robotsTxt, 'cohere-ai'),
  };
  return bots; // { GPTBot: 'allowed'|'blocked'|'not_specified' }
}
```

**B. Content Structure Checks**
- Does the page have a clear `<h1>`?
- Is `<h1>` → `<h2>` → `<h3>` hierarchy logical (no skipped levels)?
- Is body text readable (no JS-only rendered content without SSR)?
- Are images missing `alt` text? (LLMs use alt text to understand image content)
- Does the page have a `<meta name="description">`?
- Does the page use semantic HTML5 elements (`<article>`, `<main>`, `<section>`)?

**C. Trust Signal Checks**
- Is there a valid SSL certificate?
- Does the site have an `about` page linked from nav?
- Does the site have author bylines on content pages?
- Are there schema markup types present? (`Article`, `Organization`, `FAQPage`, `HowTo`)
- Does `<head>` contain `og:` and `twitter:` tags?

**D. Content Chunking Assessment**
- Average paragraph length (LLMs prefer chunks of 2–4 sentences)
- Presence of numbered lists and bullet points (AI-friendly structure)
- Internal link density per page

**E. AI Indexability Score**
Compute a score 0–100 from all checks above, weighted:
- Bot permissions: 25 points
- Content structure: 30 points
- Trust signals: 25 points
- Content chunking: 20 points

### Data Model

```sql
CREATE TABLE llm_audit_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  audit_run_id    UUID NOT NULL,
  page_url        TEXT NOT NULL,
  ai_indexability_score INTEGER,              -- 0-100
  bot_permissions JSONB,                      -- { GPTBot: 'allowed', ClaudeBot: 'blocked', ... }
  content_checks  JSONB,                      -- { h1_present: true, hierarchy_valid: false, ... }
  trust_signals   JSONB,                      -- { ssl: true, author_byline: false, schema_types: ['Article'], ... }
  content_chunking JSONB,                     -- { avg_para_length: 4.2, has_lists: true, internal_links: 8 }
  issues          JSONB,                      -- [{ type, severity, description, fix }]
  audited_at      TIMESTAMPTZ DEFAULT now()
);
```

### UI Components

**`<LLMAuditReport />`**
- Score gauge (0–100) with grade label (Excellent / Good / Needs Work / Poor)
- Four section scores: Bot Permissions | Content Structure | Trust Signals | Chunking
- Per-check results list: ✓ Pass / ✗ Fail / ⚠ Warning, with fix recommendation
- Bot permission matrix: table of LLM bots vs. allowed/blocked/unknown
- Page-by-page breakdown with individual scores

---

## 3.2 Internal Link Structure Analyzer

### What It Does
Map the internal linking graph of the client's site. Identify pages with no incoming internal links (orphan pages), pages with too many outgoing links, and show how link equity flows through the site.

### Implementation

During site crawl, build an adjacency list of internal links:
```javascript
// For each crawled page, extract all internal hrefs
function extractInternalLinks(html, baseUrl) {
  const links = [];
  // Parse all <a href="..."> tags
  // Filter: same domain, exclude external, mailto, tel, #anchors
  // Normalize: remove trailing slashes, lowercase
  return links; // ['/about', '/blog/post-1', ...]
}
```

### Data Model

```sql
CREATE TABLE internal_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  crawl_id        UUID NOT NULL,
  source_url      TEXT NOT NULL,
  target_url      TEXT NOT NULL,
  anchor_text     TEXT,
  is_nofollow     BOOLEAN DEFAULT false
);

-- Pre-computed link scores per page
CREATE TABLE page_link_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id),
  crawl_id            UUID NOT NULL,
  page_url            TEXT NOT NULL,
  incoming_link_count INTEGER DEFAULT 0,
  outgoing_link_count INTEGER DEFAULT 0,
  link_score          INTEGER,               -- 0-100 based on incoming relative to site avg
  is_orphan           BOOLEAN DEFAULT false  -- incoming_link_count = 0
);
```

### UI Components

**`<InternalLinkAnalyzer />`**
- Summary stats: Total pages | Orphan pages | Avg incoming links | Max links on any page
- Table: Page URL | Incoming Links | Outgoing Links | Link Score | Orphan flag
- Orphan pages tab — filtered list of pages with 0 incoming internal links + fix suggestions (which pages should link to them)
- Highlight top pages by link score (these are your most link-authoritative pages)

---

## 3.3 URL Indexing Monitor

### What It Does
Track which URLs are indexed by Google, which are discovered but not indexed, and allow users to submit indexing requests directly — surfacing this in context with content the platform has generated.

### Integration
Use Google Search Console Indexing API + URL Inspection API:
- `GET https://searchconsole.googleapis.com/v1/urlInspection/index:inspect` — check indexing status for a URL
- `POST https://indexing.googleapis.com/v3/urlNotifications:publish` — request indexing for a URL

### Data Model

```sql
CREATE TABLE url_indexing_status (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  page_url        TEXT NOT NULL,
  status          VARCHAR(30),               -- 'indexed' | 'discovered_not_indexed' | 'crawled_not_indexed' | 'not_found' | 'error'
  last_crawled_at TIMESTAMPTZ,
  indexing_requested_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL,
  gsc_verdict     TEXT,                      -- raw verdict from GSC URL Inspection API
  UNIQUE (project_id, page_url)
);
```

---

---

# MODULE 4 — AI Agents & Workflow Automation

> **Purpose:** Allow users to query their SEO + AI search data with natural language and get data-grounded recommendations — not generic LLM outputs. Also allow scheduling these agents to run automatically.

---

## 4.1 On-Demand AI Agents

### Core Architecture

Agents are **data-first**: before calling the LLM, the agent pipeline assembles a rich context object from the platform's own data. The LLM is the reasoning engine, not the data source.

```
User Prompt
    ↓
Agent Router (classify intent → select agent type)
    ↓
Data Fetcher (pull relevant data from DB based on agent type)
    ↓
Context Builder (format data into structured LLM prompt)
    ↓
LLM Call (Claude Sonnet or GPT-4o — reasoning over real data)
    ↓
Response Parser (extract recommendations, structure output)
    ↓
Agent Response (formatted, actionable, data-cited)
```

### Agent Types to Build

**Agent: Content Refresh Analyzer**
- Trigger prompt: "Which pages need to be refreshed?"
- Data pulled: GSC data for pages with declining clicks/position over last 90 days
- Output: prioritized list of pages with traffic decay metrics + recommended refresh actions

**Agent: AI Search Visibility Auditor**
- Trigger prompt: "How am I performing in AI search?"
- Data pulled: prompt visibility results, LLM traffic sessions, citation data
- Output: visibility score, top prompts where brand appears/missing, competitor comparison

**Agent: Technical Issues Summarizer**
- Trigger prompt: "What are my most critical technical issues?"
- Data pulled: latest SEO audit results + LLM audit results
- Output: prioritized issue list with severity, impact explanation, and fix instructions

**Agent: Keyword Opportunity Finder**
- Trigger prompt: "What content should I write next?"
- Data pulled: GSC impressions-with-low-CTR keywords + prompt tracking gaps + existing topical map
- Output: recommended new pages/topics ranked by estimated impact

**Agent: Google vs AI Search Comparator**
- Trigger prompt: "How does my Google traffic compare to AI search traffic?"
- Data pulled: GSC stats + LLM traffic sessions
- Output: side-by-side comparison with trends, conversion rates per channel

### Context Builder Example

```javascript
async function buildContentRefreshContext(projectId, dateRange) {
  // Pull declining pages from GSC data
  const decliningPages = await db.query(`
    SELECT page, 
           SUM(clicks) as recent_clicks,
           AVG(avg_position) as recent_position
    FROM gsc_keyword_data
    WHERE project_id = $1 AND date >= $2
    GROUP BY page
    HAVING AVG(avg_position) > (
      SELECT AVG(avg_position) FROM gsc_keyword_data
      WHERE project_id = $1 AND date < $2 AND date >= $3
    )
    ORDER BY recent_clicks DESC
    LIMIT 20
  `, [projectId, dateRange.recent.start, dateRange.historical.start]);

  return `
    You are an SEO strategist analyzing real performance data for a website.
    
    ## Declining Pages (last 90 days vs previous 90 days):
    ${JSON.stringify(decliningPages.rows, null, 2)}
    
    Based on this data, provide:
    1. Top 5 pages that most urgently need a content refresh (ranked by traffic loss severity)
    2. For each page: likely reason for decline and specific refresh recommendations
    3. Quick wins vs long-term fixes
    
    Be specific. Cite the data. Do not make generic recommendations.
  `;
}
```

### API Endpoints

```
POST /api/projects/:projectId/agents/run
     Body: { prompt: string, agentType?: string }
     Returns: { agentType, dataContext, response, recommendations[], citedData[] }
     
GET  /api/projects/:projectId/agents/history
     Returns: list of past agent runs with prompts and summaries
```

### UI Components

**`<AgentChat />`**
- Chat interface with pre-built prompt suggestions (quick-start buttons)
- Shows "Pulling your data..." loading state while context is assembled
- Response displays in structured format: summary + recommendation cards + data references
- Each recommendation card has: title, rationale (data-cited), action button (e.g., "Open in Content Editor")
- Conversation history in sidebar

---

## 4.2 Keyword Decay Monitoring

### What It Does
Automatically detect keywords that are losing rankings week-over-week and alert the user. No manual checking required.

### Implementation

Run a daily job:
```javascript
async function detectKeywordDecay(projectId) {
  // Compare avg_position for each keyword: last 14 days vs previous 14 days
  // Flag keywords where position dropped by > 3 positions OR clicks dropped > 20%
  // Create a decay_alert record for each flagged keyword
}
```

```sql
CREATE TABLE keyword_decay_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  keyword         TEXT NOT NULL,
  page_url        TEXT NOT NULL,
  previous_position DECIMAL(6,2),
  current_position  DECIMAL(6,2),
  position_change   DECIMAL(6,2),
  click_change_pct  DECIMAL(6,2),
  severity        VARCHAR(10),               -- 'low' | 'medium' | 'high'
  detected_at     TIMESTAMPTZ DEFAULT now(),
  is_resolved     BOOLEAN DEFAULT false
);
```

**`<DecayAlerts />`** — notification feed of decaying keywords with quick-action buttons (open in editor, analyze with agent)

---

## 4.3 Scheduled Workflow Automation

### What It Does
Allow users to schedule agent tasks to run automatically on a cadence and deliver results to Slack or email. Builds toward the "AI employees" concept — agents that work in the background without user prompting.

### Workflow Engine

```sql
CREATE TABLE scheduled_workflows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  name            TEXT NOT NULL,
  agent_type      VARCHAR(50) NOT NULL,
  prompt          TEXT NOT NULL,
  schedule_cron   VARCHAR(50) NOT NULL,       -- '0 9 * * 1' = every Monday 9am
  delivery_channel VARCHAR(20) NOT NULL,      -- 'slack' | 'email'
  delivery_target TEXT NOT NULL,              -- Slack webhook URL or email address
  is_active       BOOLEAN DEFAULT true,
  last_run_at     TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE workflow_run_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES scheduled_workflows(id),
  project_id      UUID NOT NULL REFERENCES projects(id),
  ran_at          TIMESTAMPTZ NOT NULL,
  status          VARCHAR(20),               -- 'success' | 'failed' | 'partial'
  agent_response  TEXT,
  delivered       BOOLEAN DEFAULT false,
  error_message   TEXT
);
```

### Pre-built Workflow Templates

Provide these as one-click templates:

| Template Name | Cadence | Delivery |
|---|---|---|
| Weekly AI Search Summary | Every Monday 9am | Slack / Email |
| Monthly Content Refresh Report | 1st of month | Email |
| Weekly Keyword Decay Alert | Every Friday | Slack |
| Technical Issues Digest | Every Monday | Email |
| New Content Opportunities | Every 2 weeks | Email |

### UI Components

**`<WorkflowBuilder />`**
- Template picker (pre-built workflows above)
- Custom builder: choose agent type → write prompt → set schedule (cron picker) → set delivery channel
- Active workflows list with last run status, next run time, enable/disable toggle
- Run history table per workflow

---

---

# Integration & Shared Infrastructure

## Authentication & Multi-tenancy

Each platform user can have multiple **Projects** (one per client website). All new data tables include `project_id` as a foreign key. Ensure all API endpoints validate that the requesting user owns the project.

## Integrations Required

| Integration | Purpose | Auth Method |
|---|---|---|
| Google Search Console API | Keyword + page performance data | OAuth 2.0 |
| Google Analytics 4 API | Conversion and session data | OAuth 2.0 |
| Google Indexing API | URL submission | Service Account |
| Perplexity API | Prompt visibility tracking | API Key |
| OpenAI API (with search) | Prompt visibility tracking | API Key |
| Slack Incoming Webhooks | Workflow delivery | Webhook URL |
| SMTP / SendGrid | Workflow email delivery | API Key |

## Background Jobs

Use a job queue (Bull/BullMQ for Node.js, Celery for Python, or similar):

| Job | Schedule | Description |
|---|---|---|
| `gsc:sync` | Daily 2am | Pull last 3 days of GSC data |
| `prompts:check` | Every 24–72h per plan | Query AI engines for tracked prompts |
| `decay:detect` | Daily 6am | Run keyword decay detection |
| `workflows:execute` | Every 15 min | Check for scheduled workflows due to run |
| `llm-audit:run` | On demand + weekly | Run LLM crawlability audit |
| `llm-stats:aggregate` | Hourly | Re-aggregate LLM traffic stats table |

## Notifications

Build a central `notifications` table that feeds an in-app notification bell:

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id),
  user_id     UUID NOT NULL,
  type        VARCHAR(50),           -- 'keyword_decay' | 'audit_complete' | 'workflow_run' | 'ai_visibility_drop'
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

---

---

# Implementation Priorities

## Phase 1 — Ship First (Weeks 1–6)

These are the minimum viable features to be competitive in the AI-era SEO space:

- [ ] Google Search Console OAuth integration + data sync
- [ ] Keyword Performance Dashboard (clicks, impressions, position tiers, trends)
- [ ] Landing Page Analytics
- [ ] LLM Traffic Tracking (referrer detection + session ingestion)
- [ ] LLM Engine Overview Dashboard
- [ ] LLM Crawlability Audit (bot permissions + content structure + trust signals)

## Phase 2 — Differentiation (Weeks 7–14)

- [ ] Prompt Visibility Tracking (add prompts, query AI engines, track over time)
- [ ] AI Brand Visibility Score
- [ ] Conversion Attribution (connect sessions to conversion events)
- [ ] Internal Link Structure Analyzer
- [ ] URL Indexing Monitor
- [ ] On-Demand AI Agents (Content Refresh + Technical Issues agents first)

## Phase 3 — Scale & Retention (Weeks 15–24)

- [ ] AI Brand Sentiment Analysis
- [ ] AI Citations Analysis
- [ ] Keyword Decay Monitoring + Alerts
- [ ] Scheduled Workflow Automation (Slack + Email delivery)
- [ ] Geographic + Device traffic breakdown
- [ ] Custom Report Builder
- [ ] Full Workflow Template Library

---

---

# Notes for Copilot

- All new modules should follow existing project conventions for folder structure, naming, and code style
- Each database migration should be backwards-compatible — no breaking changes to existing tables
- API responses should follow existing response envelope format (e.g., `{ data, meta, errors }`)
- UI components should use the existing design system (components, tokens, theme)
- All LLM calls in agents should be model-agnostic (accept model as config param) — do not hardcode a specific model
- Sensitive credentials (OAuth tokens, API keys) must be encrypted at rest — do not store plaintext
- Add appropriate rate limiting to all new API endpoints
- Write unit tests for: data models, API endpoints, context builders, and audit check functions
- The tracking script (LLM traffic + attribution) must be < 5kb unminified, < 2kb minified
- All charts use the existing charting library already in the project (if Recharts, use Recharts; do not introduce a new charting dependency)
