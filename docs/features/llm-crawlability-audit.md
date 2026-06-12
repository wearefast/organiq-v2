# LLM Crawlability Audit

## Overview

The LLM Crawlability Audit is a standalone feature that audits a project's pages for AI engine discoverability. It checks whether AI bots can access and understand each page, scores content structure and trust signals, and surfaces actionable recommendations — all without being part of the 18-step workflow pipeline.

**Route:** `/workspaces/:wId/projects/:pId/ai-search/llm-audit`

> **Note:** This is separate from the workflow's Step 3 `site-audit` agent, which is a GEO+SEO audit embedded in the pipeline. The LLM Crawlability Audit is triggered on demand and has its own data table.

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `server/src/features/audit/llm-audit.controller.ts` | REST endpoints |
| `server/src/features/audit/llm-audit.service.ts` | All audit logic, scoring, DB writes |
| `server/src/features/audit/llm-audit.module.ts` | NestJS module registration |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/features/analytics/services/llm-audit.service.ts` | API calls + TypeScript interfaces |
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/ai-search/llm-audit/page.tsx` | Full audit dashboard page |

### Database

| File | Purpose |
|------|---------|
| `server/src/db/schema.ts` | `llmAuditResults` table definition |
| `server/drizzle/0009_violet_invaders.sql` | Migration that creates the table |

---

## API Endpoints

Base path: `/projects/:projectId/audit/llm`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/run` | Trigger a new audit run |
| `GET` | `/latest` | Get most recent audit results |
| `GET` | `/history` | List past audit runs (up to 100) |

All endpoints require `ClerkGuard` + `OrgMembershipGuard`.

---

## Data Model

**Table: `llm_audit_results`**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `project_id` | uuid | FK → `projects.id` (cascade delete) |
| `audit_run_id` | uuid | Groups all pages from one audit run |
| `page_url` | text | URL of the audited page |
| `ai_indexability_score` | integer | 0–100 composite score |
| `bot_permissions` | jsonb | Per-bot status: `'allowed'` \| `'blocked'` \| `'not_specified'` |
| `content_checks` | jsonb | Content structure analysis flags |
| `trust_signals` | jsonb | Authority and trust indicators |
| `content_chunking` | jsonb | How well content segments for LLM retrieval |
| `issues` | jsonb | Array of detected issues with fix instructions |
| `audited_at` | timestamp | When the audit ran (indexed) |

**Indexes:**
- `(project_id)` — Project lookup
- `(audit_run_id)` — Run lookup
- `(project_id, audit_run_id)` — Fetch latest run for a project

---

## Scoring System

The composite `ai_indexability_score` (0–100) is the sum of four category scores:

| Category | Max Points | What it measures |
|----------|-----------|-----------------|
| Bot Permissions | 20 | Weighted score: `allowed`=1.0, `not_specified`=0.5, `blocked`=0 × 20 pts |
| Content Structure | 25 | HTML quality, headings, meta description, semantic elements, alt text |
| Trust Signals | 25 | HTTPS, About page, author byline, JSON-LD schema, OG/Twitter tags |
| Content Chunking | 20 | Paragraph length, lists, internal link count |

> **Hard penalty cap:** If any priority bot (GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot, Google-Extended) is blocked **or** the page has a `noindex` directive (`<meta name="robots">` or `X-Robots-Tag`), the overall score is capped at **40** regardless of other signals.

**Grade labels:**

| Score | Grade |
|-------|-------|
| ≥ 80 | Excellent |
| ≥ 60 | Good |
| ≥ 40 | Needs Work |
| < 40 | Poor |

### Category Detail

#### Bot Permissions (0–20 pts)
- Fetches and parses live `robots.txt` on every audit run
- Score: `(allowed × 1.0 + not_specified × 0.5) / total_bots × 20` — rewards explicit configuration
- **Priority bots** (block triggers hard cap): `GPTBot`, `ClaudeBot`, `OAI-SearchBot`, `PerplexityBot`, `Google-Extended`
- **Hard cap**: score ≤ 40 if any priority bot is blocked or page has `noindex` directive
- Issues: High severity if any LLM bot is blocked via `Disallow: /` or `Disallow: /*`

#### Content Structure (0–25 pts)

| Check | Points |
|-------|--------|
| H1 present | +5 |
| Valid heading hierarchy (no skipping levels) | +5 |
| Meta description present | +5 |
| Semantic HTML elements (`<article>`, `<main>`, `<section>`, etc.) | +5 |
| Images have alt text | +2 |
| Not a JS-only SPA shell (`#root`, `#app`, `#__next` only) | +3 |

#### Trust Signals (0–25 pts)

| Check | Points |
|-------|--------|
| HTTPS / SSL | +7 |
| Author byline detected | +5 |
| JSON-LD schema present | +5 |
| About page link present | +3 |
| Open Graph meta tags | +3 |
| Twitter Card meta tags | +2 |

#### Content Chunking (0–20 pts)

| Check | Points |
|-------|--------|
| Avg paragraph length 2–4 sentences | +8 |
| Avg paragraph length 5 sentences | +5 |
| Bullet or numbered lists present | +6 |
| ≥ 5 internal links | +6 |
| ≥ 3 internal links | +3 |

---

## Issues

Issues are attached to each page result and aggregated in the UI by severity.

| Type | Severity | Trigger |
|------|----------|---------|
| `bot_blocked` | High | One or more LLM bots blocked in `robots.txt` (single consolidated issue) |
| `schema` | High | No JSON-LD found on the page |
| `schema` | Medium | Schema present but no AI-priority types (Article, FAQPage, HowTo) |
| `sitemap` | High | No valid `sitemap.xml` at `/sitemap.xml` |
| `sitemap` | Medium | Page URL not found in the sitemap |
| `llms_txt` | High | No `/llms.txt` file found at site root |
| `llms_txt` | Medium | `/llms.txt` found but missing H1 + blockquote structure |
| `llms_txt` | Low | Page not referenced in `/llms.txt` |
| `freshness` | High | No `dateModified` in JSON-LD schema |
| `freshness` | Medium | `dateModified` is older than 12 months |
| `freshness` | Medium | No `<lastmod>` in sitemap.xml for this page |
| `citation` | Medium | No FAQ section detected |
| `citation` | Low | No comparison table found |
| `citation` | Low | No numbered step list found |
| `citation` | Low | No outbound links to authoritative sources |
| `structure` | Varies | Content structure check failures |
| `trust` | Varies | Missing trust signal indicators |
| `chunking` | Varies | Poor paragraph length or link count |

Each issue includes a `fix` field with a concrete remediation instruction shown in the UI.

---

## Audit Run Process

1. Load project domain and stored sitemap URLs (or discover live if none cached)
2. Fetch fresh `robots.txt` — evaluated once, applied to all pages
3. Fetch `/llms.txt` — evaluated once, applied to all pages (empty string if absent)
4. Audit pages in **batches of 5** (controlled by `AUDIT_BATCH_SIZE`)
5. For each page: fetch HTML, run all **nine** checks, calculate score, collect issues
6. Persist all page results in a single DB insert under a shared `auditRunId`
7. Return overall score (average of all page scores)

---

## UI — Dashboard Sections

### Score Banner
Large 0–100 score with grade label, pages-audited count, and last-run timestamp.
- **Δ vs previous run** badge (e.g. `↑ +5` / `↓ -3`) shown below grade label when ≥ 2 history entries exist
- **Score sparkline** (last 8 runs, oldest→newest left-to-right) rendered as inline SVG below the delta badge

### Section Scores
7-column grid (responsive) showing each category's score with a color-coded progress bar:
- Bot Permissions (max 20), Content Structure (max 25), Trust Signals (max 25), Content Chunking (max 20)
- LLM Discovery (max 10), Freshness (max 7), Citation Readiness (max 20), E-E-A-T (max 8)

### Bot Access Matrix
Table of all **16** monitored LLM bots grouped by category (Training Crawlers, Search & Answer, Real-time Fetchers) with:
- Status badge: Allowed / Blocked / Not Specified
- Bot owner and crawl purpose description

### Page Breakdown
Per-page table (URL, score, issue count) sorted by score descending. Shown when multiple pages are audited.

### Recommendations
Aggregated issues across all pages, sorted high → medium → low severity. Each row shows the issue description, affected page count, and fix instruction.

### Audit History Panel
Collapsible panel below Recommendations. Hidden when only one audit run exists.
- Rows: date, score (colour-coded), Δ vs previous run, page count
- Current run row is highlighted
- History is co-fetched with the latest audit on page load; refreshed after every new run

### Actions
- **Run Audit** — Triggers a new full audit via `POST /run`
- **Refresh Sitemap** — Refreshes cached sitemap URLs via `POST /projects/:id/refresh-sitemap` before running a new audit

---

## Integration: On-Demand Agents

The `technical-issues` context builder (`server/src/features/on-demand-agents/context-builders/technical-issues.builder.ts`) fetches the latest 20 page results from `llm_audit_results` and injects them into on-demand agent prompts. This allows the "Technical SEO and AI-readiness expert" agent to reference audit findings without re-running audits.

---

## Improvement Analysis

### Executive Summary

Research across the current AI agent ecosystem (knownagents.com — 34+ pages of known agents), the llms.txt specification (llmstxt.org), GEO/AEO best practices, and the full implementation source reveals **six high-impact gaps** in the current audit. The scoring model is functional but misses the fastest-growing surface areas for AI discoverability in 2025–2026.

---

### Gap 1 — Bot Coverage Is Critically Outdated

**Current state:** 6 bots monitored — `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Applebot`, `cohere-ai`

**The problem:** The AI agent landscape has expanded dramatically. As of mid-2026, there are 40+ significant AI crawlers, assistants, and agents making HTTP requests. The current list misses the majority of high-volume bots:

| Missing Bot | Owner | Why It Matters |
|-------------|-------|----------------|
| `OAI-SearchBot` | OpenAI | Powers ChatGPT Search real-time retrieval — distinct from GPTBot training |
| `ChatGPT-User` | OpenAI | Fetches URLs when a user pastes a link into ChatGPT |
| `Claude-User` | Anthropic | Fetches URLs on demand when Claude users share links |
| `Perplexity-User` | Perplexity | Real-time fetch for user queries in Perplexity answers |
| `meta-externalagent` | Meta (Llama) | Meta AI search crawler |
| `meta-externalfetcher` | Meta | User-initiated fetch for Meta AI assistant |
| `DuckAssistBot` | DuckDuckGo | Powers DuckDuckGo AI answers |
| `Gemini-Deep-Research` | Google | Deep Research feature — distinct from Google-Extended |
| `Bravebot` | Brave | Powers Brave Search AI and RAG pipelines |
| `YouBot` | You.com | AI-native search engine |
| `Bytespider` | ByteDance | TikTok/Doubao LLM training — widely blocked by publishers |
| `Applebot-Extended` | Apple | Apple Intelligence training — separate from standard Applebot |
| `TavilyBot` | Tavily | Primary data provider for LangChain/AI agent ecosystems |
| `ExaBot` | Exa.ai | Semantic AI search indexer used in many RAG pipelines |
| `Amazonbot` | Amazon | Alexa and Amazon AI services |
| `MistralAI-User` | Mistral | Le Chat real-time web browsing |

**Also missing:** The current parser doesn't correctly handle `Allow:` overrides. A `User-agent: GPTBot / Disallow: / / Allow: /blog/` pattern gives GPTBot access to `/blog/` but the current code marks it as fully `blocked`.

**Also: scoring problem** — `not_specified` scores the same as `allowed` (both are "non-blocked"). This is misleading: an unspecified bot may be allowed but the site owner hasn't made an active decision. This should surface as a distinct advisory, not be silent.

**Recommended fix:**
- Expand the bot list to ~16 bots across categories: Training Scrapers, Search Assistants, Real-Time Fetchers, RAG Data Providers
- Add bot categories to the matrix UI (Training vs. Real-time Search vs. Agentic)
- Fix `Allow:` override handling in `parseBotStatus`
- Surface `not_specified` as a separate advisory in the UI (gray status = unconfigured, not approved)

---

### Gap 2 — `/llms.txt` Not Checked

**Current state:** Not detected, not scored.

**The problem:** The `llms.txt` standard (llmstxt.org, authored by Jeremy Howard / Answer.AI, published September 2024) has become the primary protocol for LLM-optimized content discovery — analogous to `/robots.txt` for traditional crawlers and `/sitemap.xml` for search engines. Major documentation sites, product sites, and SaaS platforms have adopted it. It serves a different purpose from both:

- `robots.txt` — controls access permissions
- `sitemap.xml` — lists all crawlable URLs for indexers
- `llms.txt` — provides a **curated, LLM-readable Markdown summary** of the site with links to key content, designed for inference-time context injection (not training)

A compliant `/llms.txt` file contains: an H1 with site name, a blockquote summary, and `##` sections listing key pages as markdown links with descriptions.

**Recommended addition to the audit:**

| Check | Points | Condition |
|-------|--------|-----------|
| `/llms.txt` exists at root | +8 | Valid markdown file found |
| `/llms.txt` has required H1 + blockquote | +4 | Structurally compliant |
| Key pages referenced in `/llms.txt` | +3 | Audited page URL appears in llms.txt |

Add a new **"LLM Discovery Files"** category (15 pts max) to the scoring model, adjusting the overall composite to 115 pts normalized to 100.

---

### Gap 3 — Content Freshness Entirely Absent

**Current state:** No freshness checks. Older audit runs have no staleness flag.

**The problem:** AI engines — particularly Perplexity, ChatGPT Search, and Google AI Overviews — heavily weight content recency for informational and competitive queries. Stale pages (no `dateModified`, old `<lastmod>` in sitemap, no `Last-Modified` HTTP header) are deprioritized in real-time answer generation.

The following signals indicate freshness to LLM crawlers:

1. `datePublished` / `dateModified` in JSON-LD schema — most important
2. `<lastmod>` in `sitemap.xml` — used by crawlers to prioritize re-fetching
3. `Last-Modified` HTTP response header — checked at crawl time
4. `<meta name="revised" content="...">` — legacy but still parsed

**Recommended additions:**

Add to `TrustSignals` (or a new `ContentFreshness` category):

| Check | Points | Condition |
|-------|--------|-----------|
| `dateModified` in JSON-LD | +4 | Present and within 12 months |
| `<lastmod>` present in sitemap for this URL | +3 | Sitemap has `<lastmod>` tag |
| `Last-Modified` HTTP header present | +2 | Crawl response header check |

Add an issue: `freshness` / High — "No `dateModified` in schema — AI answer engines deprioritize undated content"

---

### Gap 4 — Citation-Readiness (AEO/GEO) Not Measured

**Current state:** Content chunking only checks paragraph length, lists, and internal links.

**The problem:** The most impactful signal for GEO (Generative Engine Optimization) is whether content is structured for **direct extraction** by AI answer engines. This is the difference between "content AI can read" and "content AI will cite." AI Overviews, Perplexity answers, and ChatGPT Search all use RAG (retrieval-augmented generation) — they extract specific, self-contained factual passages.

Key citation-readiness signals that the current audit does not check:

| Signal | Why It Matters |
|--------|---------------|
| **FAQ section** (`<details>`, `<dt>`/`<dd>`, or `FAQPage` JSON-LD) | AI extracts Q&A pairs directly; most cited format in AI Overviews |
| **Definition sentences** ("X is a Y that...") at section openings | Triggers AI snippet extraction for definitional queries |
| **Step-by-step numbered sections** (`<ol>` with ≥3 items) | AI Overviews prominently feature how-to lists |
| **Comparison tables** (`<table>` with header row) | RAG pipelines extract tabular comparisons efficiently |
| **Answer-first structure** (key answer in first 200 words) | AI prioritizes content that front-loads conclusions |
| **Statistical/data claims** (numbers, percentages, years) | AI cites content that contains verifiable facts |
| **External citations/references** (outbound links to authoritative sources) | LLMs trust content that cites primary sources |

**Recommended:** Expand `ContentChunking` into `ContentChunking` + new `CitationReadiness` category (20 pts max):

| Check | Points |
|-------|--------|
| FAQ section detected (schema or HTML pattern) | +5 |
| Comparison table present | +4 |
| Numbered step-by-step list (≥3 items) | +4 |
| Answer in first 200 words (page summary heuristic) | +4 |
| External outbound links to authoritative sources | +3 |

---

### Gap 5 — E-E-A-T Depth Is Surface-Level

**Current state:** Trust signals check for HTTPS, an about-page link, a basic author byline pattern, JSON-LD presence, OG tags, and Twitter tags.

**The problem:** Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) framework is now the primary lens through which both Google AI Overviews and third-party AI systems assess source credibility. The current checks are first-generation — they detect the rough presence of signals but not their quality.

**Current implementation gaps:**

| Current Check | Problem |
|---------------|---------|
| `authorByline` | Matches `[class*="author"]` or text regex — fires on copyright footers and "Written by AI" |
| `schemaTypes.length > 0` | Any schema counts (+5 pts) — a `BreadcrumbList`-only page gets full trust credit |
| No check for `Person` schema | Missing the most direct author-credentialing signal |
| No check for `Organization` schema | Missing the entity establishment signal |
| `hasAboutPage` | Only +3 pts and only detects `/about` links — about page is actually a strong E-E-A-T anchor |
| No author credentials check | Byline detection ≠ credentials (author expertise schema, qualifications text) |
| No external links check | Sites that cite sources are treated identically to sites that don't |

**Recommended improvements:**

| Check | Points | Implementation |
|-------|--------|----------------|
| `Person` schema with `name` + `url` | +4 | JSON-LD `@type: Person` with name and URL properties |
| `Organization` schema with `name` + `url` | +3 | JSON-LD `@type: Organization` |
| Author has linked credentials (schema `sameAs`, `affiliation`) | +3 | `Person.sameAs` or `Person.affiliation` present |
| External outbound links to `.gov`, `.edu`, or high-authority domains | +2 | Domain extension check |
| `datePublished` in JSON-LD | +2 | Signals original publication date |

Move Twitter tags (-2 pts) to a lower-weight advisory signal rather than scored — it's a weak trust proxy.

---

### Gap 6 — `X-Robots-Tag` HTTP Header Not Checked

**Current state:** Bot permission analysis only reads `robots.txt`. Page HTML is fetched and parsed, but HTTP response headers are not inspected.

**The problem:** `X-Robots-Tag` is an HTTP response header that can block AI crawlers from indexing a specific page even if `robots.txt` allows it. It takes the same directives as `<meta name="robots">` but applies at the server level:

```
X-Robots-Tag: noindex
X-Robots-Tag: noai
X-Robots-Tag: noimageai
```

The `noai` and `noimageai` directives were introduced specifically to block AI training scrapers and are increasingly used by publishers. A page that passes `robots.txt` but has `X-Robots-Tag: noindex` will not be indexed by any crawler.

**Additionally**, the current code checks `jsRenderedOnly` but doesn't check for:
- `<meta name="robots" content="noindex">` — page-level noindex
- `<meta name="robots" content="noai">` — explicit AI block at the page level

**Recommended fix:** When fetching page HTML, also capture and parse:
1. `X-Robots-Tag` response header
2. `<meta name="robots">` content attribute

Add a new issue type: `page_blocked` / High — "Page has `noindex` or `noai` directive — AI crawlers cannot index this page despite robots.txt allowing access"

---

### Gap 7 — Scoring Model Has Structural Problems

**Current state:** `botScore (0-25) + contentScore (0-30) + trustScore (0-25) + chunkScore (0-20) = 0-100`

**Problems identified:**

1. **Bot blocking should be a hard penalty, not a proportional deduction.** If 1 of 6 bots is blocked, you lose ~4 points. But in practice, blocking `GPTBot` means ChatGPT cannot train on or reference your content — that's a catastrophic AI visibility loss, not a minor deduction. Bot blocking should trigger a score cap (e.g. max 40 if any high-priority bot is blocked).

2. **`not_specified` scores identically to `allowed`.** A site that has never configured its robots.txt for any of the 6 bots gets a full 25/25 bot score. This is misleading — `not_specified` means the site is passively relying on default behavior, which for some bots (e.g. `Bytespider`) means they will crawl aggressively.

3. **Content category weighting doesn't reflect AI-era reality.** In the current model, Content Structure has the highest weighting (30 pts) but Trust Signals and freshness are more decisive for AI citation decisions in 2025–2026. A technically structured page with no E-E-A-T signals will not be cited by Perplexity or ChatGPT.

**Recommended scoring rebalance:**

| Category | Current Max | Proposed Max | Reason |
|----------|------------|-------------|--------|
| Bot Permissions | 25 | 20 + hard penalty cap | Penalize blocking; reward explicit allow |
| Content Structure | 30 | 25 | Good baseline — reduce slightly |
| Trust & E-E-A-T | 25 | 25 | Keep — but improve quality of checks (Gap 5) |
| Content Chunking + Citation Readiness | 20 | 20 | Keep weight, add citation checks |
| LLM Discovery Files | 0 | 10 | New category (llms.txt, freshness) |
| **Total** | **100** | **100** | Normalized |

---

### Gap 8 — Audit History Is Stored But Not Surfaced

**Current state:** `GET /history` returns historical run summaries. The frontend has no UI for this data.

**The problem:** Score trends over time are one of the most actionable outputs of any technical audit tool — users need to see whether their optimizations are working. Currently:
- History endpoint returns correct data
- Frontend fetches only the latest audit on mount
- No trend chart, no delta comparison between runs, no "last run vs. this run" view

**Recommended UI addition:**
- Compact score history sparkline on the score banner
- "Δ vs. previous run" badge (+5 / -3) on score banner and each category score
- History table in a collapsible panel (runs, date, score, page count)

---

### Implementation Priority

| Priority | Gap | Status | Estimated Effort | Impact |
|----------|-----|--------|-----------------|--------|
| P0 | Gap 1: Expand bot list to 16 bots + fix Allow: parser | ✅ Done | Low | Critical |
| P0 | Gap 6: Check `X-Robots-Tag` + `<meta name="robots">` | ✅ Done | Low | High |
| P1 | Gap 2: Add `/llms.txt` detection + scoring | ✅ Done | Medium | High |
| P1 | Gap 3: Add content freshness checks | ✅ Done | Low-Medium | High |
| P1 | Gap 4: Add citation-readiness checks (FAQ, tables, steps) | ✅ Done | Medium | High |
| P2 | Gap 5: Deepen E-E-A-T with Person/Org schema + credentials | ✅ Done | Medium | Medium |
| P2 | Gap 7: Rebalance scoring model with bot-block cap | ✅ Done | Low | Medium |
| P3 | Gap 8: Add score history trend to UI | ✅ Done | Medium | Medium |
