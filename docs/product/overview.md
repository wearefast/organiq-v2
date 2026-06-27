# Pulse OS — Product Overview

> Agent-led SEO/GEO/AEO strategy consultant operating system for agencies.

## What Is Pulse?

Pulse is a SaaS platform that automates the entire SEO strategy lifecycle — from initial keyword research and competitor analysis through topical mapping, content generation, and performance reporting. It replaces manual consultant workflows with an **18-step AI agent pipeline** featuring human-in-the-loop approval at every checkpoint.

## Who Is It For?

| Persona | Use Case |
|---------|----------|
| SEO Agencies | Deliver white-label strategy reports and content plans at scale |
| In-house SEO Teams | Accelerate keyword research and content production workflows |
| Content Marketers | Generate briefs and articles grounded in data-driven keyword strategy |
| Consultants | Produce comprehensive strategy documents in hours instead of weeks |

## Core Value Proposition

1. **18-Step Guided Workflow** — Structured pipeline from discovery to content, with no missed steps
2. **AI Agents + Human Approval** — Every output is reviewable and revisable before the pipeline continues
3. **Multi-Org & Multi-Project** — Hierarchical model: Organization → Workspace → Project
4. **Credit-Based Usage** — Granular billing per workflow step; no flat monthly fee waste
5. **Comprehensive Reporting** — PDF reports generated from workflow data (strategy, keyword, content plan, AI visibility)

## Product Model

```
Organization (Clerk-managed)
 └── Workspace(s)
      └── Project(s)     — one domain/market per project
           ├── Workflow Runs  — 18-step agent pipeline
           ├── Keywords       — discovered, scored, categorized
           ├── Topical Maps   — pillars → clusters → keywords
           ├── Content Pieces — briefs + articles
           └── Reports        — PDF strategy documents
```

## The 18-Step Workflow

The workflow is organized into **4 phases**, each building on the previous. Every step is executed by a specialized AI agent that uses external tools (Ahrefs, DataForSEO, Serper, etc.) and produces structured JSON output.

### Phase 1 — Intelligence & Audit (Steps 1–8)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 1 | `business-profile` | Discovery & profiling (enhanced with Firecrawl) | 30 |
| 2 | `seed-keywords` | Initial keyword discovery from business context | 100 |
| 3 | `site-audit` | GEO citability + technical SEO audit | 60 |
| 4 | `ai-intelligence` | AI search intelligence (Brand Radar + DataForSEO) | 50 |
| 5 | `serp-niche-map` | SERP & niche landscape mapping | 45 |
| 6 | `competitor-buckets` | Competitor identification & classification | 35 |
| 7 | `competitor-metrics` | Competitor traffic, keyword, and content gap analysis (enhanced with AI SoV) | 55 |
| 8 | `search-demand` | Search demand & seasonality (DataForSEO + Ahrefs) | 50 |

**Phase 1 subtotal: 425 credits**

### Phase 2 — Keyword Research (Steps 9–13)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 9 | `phase1-baseline` | Client baseline consolidation | 45 |
| 10 | `method01-competitor-pages` | Method 01 — Extract keywords from competitor pages | 55 |
| 11 | `method02-seed-expansion` | Method 02 — Expand seed keywords with related terms | 50 |
| 12 | `method03-content-gap-import` | Method 03 — Content gap import (manual) | 30 |
| 13 | `consolidated-keywords` | Merge all keywords into final taxonomy | 0 |

**Phase 2 subtotal: 180 credits**

### Phase 3 — Strategy & Planning (Steps 14–15)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 14 | `verdict-strategy` | Final strategy verdict with roadmap | 35 |
| 15 | `topical-map` | Build hierarchical topical map & content calendar | 40 |

**Phase 3 subtotal: 75 credits**

### Phase 4 — Content Production (Steps 16–18)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 16 | `content-brief` | Generate SEO-optimized brief for writers | 25 |
| 17 | `content-article` | Draft full article from brief | 30 |
| 18 | `content-images` | Generate image suggestions/assets for article | 25 |

**Phase 4 subtotal: 80 credits per content unit**

**Total credits per full workflow run: ~760** (Phases 1–3: 680 fixed + Phase 4: 80 per content unit)

## Key Concepts

### Workflow Run States

| State | Description |
|-------|-------------|
| `draft` | Created but not started |
| `running` | Steps are being executed |
| `paused` | Awaiting human approval on a step |
| `completed` | All steps finished successfully |
| `failed` | A step failed and was not recovered |

### Step States

| State | Description |
|-------|-------------|
| `pending` | Not yet started; waiting for dependencies |
| `running` | Agent is executing |
| `completed` | Agent produced validated output |
| `awaiting_approval` | Output ready for human review |
| `approved` | Human approved; downstream steps unblocked |
| `revision_requested` | Human requested changes; agent re-executes |
| `rejected` | Human rejected; step is dead |
| `failed` | Agent error; no output produced |
| `skipped` | Step was bypassed |

### Credit System

- Each workflow step has a fixed credit cost
- Credits are debited atomically via the `credit_ledger` table
- Organization credit balance is maintained on the `organizations` table
- Credit types: `purchase`, `usage`, `refund`, `bonus`

### Report Types

| Type | Description |
|------|-------------|
| `full_strategy` | Comprehensive SEO strategy report |
| `ai_visibility` | AI/GEO/AEO opportunity analysis |
| `keyword_research` | Keyword research summary with scoring |
| `content_plan` | Content calendar and topical roadmap |

Reports are generated from workflow run data, interpolated into Markdown templates in `server/src/prompts/reports/`, and rendered to PDF via the server-side `PdfGeneratorService` (pdfmake).
