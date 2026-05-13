# Pulse OS — Product Overview

> Agent-led SEO/GEO/AEO strategy consultant operating system for agencies.

## What Is Pulse?

Pulse is a SaaS platform that automates the entire SEO strategy lifecycle — from initial keyword research and competitor analysis through topical mapping, content generation, and performance reporting. It replaces manual consultant workflows with a **17-step AI agent pipeline** featuring human-in-the-loop approval at every checkpoint.

## Who Is It For?

| Persona | Use Case |
|---------|----------|
| SEO Agencies | Deliver white-label strategy reports and content plans at scale |
| In-house SEO Teams | Accelerate keyword research and content production workflows |
| Content Marketers | Generate briefs and articles grounded in data-driven keyword strategy |
| Consultants | Produce comprehensive strategy documents in hours instead of weeks |

## Core Value Proposition

1. **17-Step Guided Workflow** — Structured pipeline from discovery to content, with no missed steps
2. **AI Agents + Human Approval** — Every output is reviewable and revisable before the pipeline continues
3. **Multi-Org & Multi-Project** — Hierarchical model: Organization → Workspace → Project
4. **Credit-Based Usage** — Granular billing per workflow step; no flat monthly fee waste
5. **Comprehensive Reporting** — PDF reports generated from workflow data (strategy, keyword, content plan, AI visibility)

## Product Model

```
Organization (Clerk-managed)
 └── Workspace(s)
      └── Project(s)     — one domain/market per project
           ├── Workflow Runs  — 17-step agent pipeline
           ├── Keywords       — discovered, scored, categorized
           ├── Topical Maps   — pillars → clusters → keywords
           ├── Content Pieces — briefs + articles
           └── Reports        — PDF strategy documents
```

## The 17-Step Workflow

The workflow is organized into **4 phases**, each building on the previous. Every step is executed by a specialized AI agent that uses external tools (Ahrefs, DataForSEO, Serper, etc.) and produces structured JSON output.

### Phase 1 — Discovery & Foundation (Steps 1–5)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 1 | `business-profile` | Extract business model, audience, positioning | 10 |
| 2 | `seed-keywords` | Initial keyword discovery from business context | 20 |
| 3 | `competitor-buckets` | Identify and categorize competitors | 30 |
| 4 | `serp-niche-map` | Map SERP landscape by intent and features | 25 |
| 5 | `ai-intelligence` | Identify AI-native search opportunities | 30 |

### Phase 2 — Research & Analysis (Steps 6–10)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 6 | `site-audit` | Technical SEO audit of target domain | 25 |
| 7 | `competitor-metrics` | Competitor traffic, keyword, and content gap analysis | 35 |
| 8 | `search-demand` | Search volume and intent data analysis | 20 |
| 9 | `phase1-baseline` | Consolidate research into keyword baseline | 45 |
| 10 | `method01-competitor-pages` | Extract keywords from competitor pages | 40 |

### Phase 3 — Keyword Consolidation (Steps 11–14)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 11 | `method02-seed-expansion` | Expand seed keywords with related terms | 35 |
| 12 | `method03-content-gap-import` | Import gaps from external content analysis | 30 |
| 13 | `consolidated-keywords` | Merge all keywords into final taxonomy | 35 |
| 14 | `topical-map` | Build hierarchical topical structure | 50 |

### Phase 4 — Strategy & Content (Steps 15–17)

| Step | Agent | Purpose | Credit Cost |
|------|-------|---------|-------------|
| 15 | `content-brief` | Generate SEO-optimized brief for writers | 20 |
| 16 | `content-article` | Draft full article from brief | 40 |
| 17 | `verdict-strategy` | Final strategy verdict with roadmap | 55 |

**Total credits per full workflow run: ~565**

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

Reports are generated from workflow run data, interpolated into Markdown templates in `server/src/prompts/reports/`, and rendered to PDF via the Python sidecar's ReportLab endpoint.
