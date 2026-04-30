# Audit Feature

## Overview

The audit pipeline is the core lead magnet. A visitor submits their website URL and gets a free personalised SEO/GEO/AEO audit report.

## Pipeline Steps

| Step | Service | Description |
|------|---------|-------------|
| 01a | `ScraperService` | Scrape homepage (title, meta, H1s, body, links, images, schema) |
| 01b | `OpenAIService` | Generate AI business profile + service areas from scraped content |
| 02 | `OpenAIService` | Deep-read distillation (what/who/how/differentiator) |
| 03 | `PageSpeedService` | Run PageSpeed Insights (mobile + desktop) |
| 04 | `AhrefsService` + `OpenAIService` | 5-step Keyword Intelligence Chain (see below) |
| 05 | `SerpService` + `OpenAIService` | Google SERP Competitor Discovery + Classification (see below) |
| 06+ | — | Competitor Metrics, Gap Analysis, Scoring, Report (TODO) |

### Step 04: Keyword Intelligence Chain (5 sub-steps)

Each sub-step is a separate OpenAI call with typed input/output contracts.
Intermediate results stored in `rawData.keywordSteps` for debugging.
Partial results returned if a mid-chain step fails.

| Sub-step | Name | Input | Output |
|----------|------|-------|--------|
| 3.1 | Website Context Extraction | profile, deepRead, bodyText | offerings, offeringTerminology, conversionPhrases, pageMapping |
| 3.2 | Core + Money Keywords | 3.1 output + Ahrefs data | coreKeywords, moneyKeywords |
| 3.3 | Topic Clusters + Expansion | 3.2 output + profile | primaryTopics, seedExpansions |
| 3.4 | Entity Discovery | 3.2 + 3.3 outputs | nicheEntities |
| 3.5 | Dedup + Core Topics | 3.2 + 3.3 + 3.4 outputs | coreTopics |

Progress updates: 32% → 33% (Ahrefs) → 34% (3.1) → 36% (3.2) → 38% (3.3) → 40% (3.4) → 44% (3.5) → 45% (complete)

Each keyword sub-step is individually tracked via `currentStep` in `rawData`:
`KEYWORDS_RUNNING` → `KW_AHREFS_COMPLETE` → `KW_STEP_31` → `KW_STEP_32` → `KW_STEP_33` → `KW_STEP_34` → `KW_STEP_35` → `KEYWORDS_COMPLETE`

Partial `keywordSteps` object is persisted to `rawData` after each sub-step completes.

### Step 05: Google SERP Competitor Discovery

Searches seed keywords + money keywords on Google via Serper.dev, discovers competing domains, then classifies them into Direct vs Organic competitors using OpenAI.

| Sub-step | Key | Description | Output |
|----------|-----|-------------|--------|
| 5a | `COMPETITORS_RUNNING` | Select up to 10 unique keywords (5 seed + 5 money) | — |
| 5b | `SERP_COMPLETE` | Search each keyword via `SerpService.discoverCompetitors()` | `serpCandidates[]` (domain, occurrences, avgPosition, sampleUrls) |
| 5c | `COMPETITORS_COMPLETE` | Classify top 15 candidates via `OpenAIService.classifyCompetitors()` | `competitors.directCompetitors[]`, `competitors.organicCompetitors[]` |

Progress updates: 46% → 48% (SERP) → 50% (classified)

Prompt: `.prompts/4.0 - Competitor Classification Prompt.md`

Classification rules:
- **Direct competitors**: Same services, same market, same geography (max 5)
- **Organic competitors**: Authority sites, blogs, related niches ranking for same keywords (max 10)
- Falls back gracefully if `SERPER_API_KEY` is not configured (empty results)

## Analyzing Page — Control Room Visualization

When a user submits an audit, the analyzing page switches into a dark live-analysis control room instead of a simple progress bar.
During polling, analysis mode now replaces the landing-page shell instead of overlaying it, so the live workspace owns the full page state and desktop height budget.

### How it works

1. `GET /audits/:id/status` returns `completedSteps[]` (with data summaries) + `currentStep` (raw DB key)
2. Frontend `useAuditPolling` polls every 3s, passes enriched data to `<AuditPipeline>`
3. `<AuditPipeline>` renders a bounded desktop workspace with a dominant wide left process rail, a compact center AI engine stage, a telemetry column, and a restrained footer log
4. The rail shows a moving 5-stage viewport: the active stage stays in focus, older completed stages rise into a top fade mask, and upcoming stages stay below the fold
5. Keyword sub-steps (6-10) are nested under a "Keyword Intelligence Chain" section header in the left rail
6. Center stage shows a vertical input → processing orb → output stack so the engine uses less horizontal space
7. Right telemetry column only reveals real metrics as they become available; duplicate progress surfaces were removed
8. A dedicated current-phase card shows the active phase, current message, and next expected output
9. Bottom process log is capped to recent engine events only and scrolls internally if needed
10. Analysis mode uses tighter desktop typography and compressed step density so the full control room fits in a single desktop view
11. Client-side animation queue staggers multiple completions by 600ms to avoid skipping visual steps
12. A polite live region announces the active phase and progress updates for accessibility

### Pipeline steps visualized

| # | Key | Label | Data shown on complete |
|---|-----|-------|----------------------|
| 1 | SCRAPE | Crawling your website | Title, H1 count, link count, schema detected |
| 2 | PROFILE | Building AI business profile | Brand, target market, service count, seed keyword count |
| 3 | DEEPREAD | Deep-reading your content | What/who/how/differentiator |
| 4 | PAGESPEED | Analyzing page performance | Mobile perf, desktop perf, SEO score, LCP |
| 5 | KW_AHREFS | Fetching keyword data from Ahrefs | Organic count, matching count, pool size |
| 6 | KW_STEP_31 | Extracting website context | Offering count, conversion phrases, page count |
| 7 | KW_STEP_32 | Classifying core & money keywords | Core count, money count |
| 8 | KW_STEP_33 | Building topic clusters | Topic count, expansion count |
| 9 | KW_STEP_34 | Discovering entities | Entity count |
| 10 | KW_STEP_35 | Deduplicating & finalizing | Core topic count |
| 11 | SERP_COMPLETE | Searching Google for competitors | Candidate domain count |
| 12 | COMPETITORS_COMPLETE | Classifying competitors | Direct count, organic count |

### Visual zones

| Zone | Purpose |
|------|---------|
| Left rail | Ordered step sequence in a widened 5-stage viewport with fade masking for older completed stages |
| Center stage | Compact vertical AI engine stack with input cards above and output cards below the processing core |
| Right rail | Live telemetry metrics + current phase card |
| Bottom panel | DM Mono process log for the most recent engine events |

### Animations (CSS-only, no dependencies)

- `pipeline-pulse-glow` — Running step border glow
- `pipeline-flow-down` — Connector and rail motion
- `pipeline-fade-in-up` — Step entrance
- `pipeline-expand-data` — Data card reveal
- `pipeline-typing` — Typing dots indicator
- `pipeline-orbit-slow` / `pipeline-orbit-reverse` — AI core ring motion
- `pipeline-core-pulse` — AI core heartbeat
- `pipeline-beam-move` — Horizontal signal beam animation

### Reduced motion

All control-room specific animations degrade to static states under `prefers-reduced-motion: reduce` so the screen keeps its hierarchy without continuous motion.

## Audit Results Page (redesigned)

The results page at `/audit/[id]` displays audit data in a tabbed, visually structured layout.

### Layout structure

| Component | Description |
|-----------|-------------|
| Hero Header | Dark gradient banner with domain, URL, status badge, date, seed keyword count |
| Quick Stats | Horizontal metric cards (core/money keywords, topics, competitors, perf scores) with gradient numbers |
| Tab Bar | Pill navigation: Overview, Keywords & Topics, Competitors, Performance |

### Tabs

| Tab | Content |
|-----|---------|
| **Overview** | Business Profile + Deep Read (side-by-side on desktop), Seed Keywords, Website Crawl (mini-stat grid) |
| **Keywords & Topics** | Core Keywords table (KD badge colored by difficulty), Money Keywords table, Topic Clusters, Niche Entities, Core Topics (2-col grid), Seed Expansions |
| **Competitors** | Direct/Organic summary cards with counts, Direct competitor cards (domain + reason), Organic competitor cards, SERP Discovery table (domain, appearances, avg position) |
| **Performance** | Score ring charts (Perf/SEO/Accessibility) for Mobile + Desktop, Core Web Vitals (LCP/CLS/TBT with traffic-light coloring), On-Page SEO Signals (check/warn indicators) |

### Data flow

`GET /audits/:id` → `audit.service.findOne()` returns `pipeline.competitors` and `pipeline.serpCandidates` alongside existing fields.

## Scores

| Score | Max | Based On |
|-------|-----|----------|
| Technical SEO | 100 | PageSpeed, schema markup, meta tags |
| Content Coverage | 100 | Content gap, topical coverage |
| Backlink Authority | 100 | DR, referring domains, backlinks |
| AEO + GEO Readiness | 100 | AI Overview presence, structured data |

## Server Files

- `server/src/features/audit/audit.module.ts`
- `server/src/features/audit/audit.controller.ts`
- `server/src/features/audit/audit.service.ts`

## Frontend Files

- `frontend/src/features/audit/components/audit-form.tsx`
- `frontend/src/features/audit/components/audit-progress.tsx` (legacy — kept as fallback)
- `frontend/src/features/audit/components/audit-pipeline.tsx` (new — pipeline visualization container)
- `frontend/src/features/audit/components/pipeline-step.tsx` (new — individual step card)
- `frontend/src/features/audit/components/audit-score-cards.tsx`
- `frontend/src/features/audit/hooks/use-audit-polling.ts`
- `frontend/src/features/audit/services/audit.service.ts`
