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
| 05+ | — | Competitor Discovery, Gap Analysis, Scoring, Report (TODO) |

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

Progress updates: 32% → 34% (3.1) → 36% (3.2) → 38% (3.3) → 40% (3.4) → 44% (3.5) → 45% (complete)

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
- `frontend/src/features/audit/components/audit-progress.tsx`
- `frontend/src/features/audit/components/audit-score-cards.tsx`
- `frontend/src/features/audit/hooks/use-audit-polling.ts`
- `frontend/src/features/audit/services/audit.service.ts`
