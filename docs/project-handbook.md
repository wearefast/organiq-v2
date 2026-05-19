# Pulse OS — Project Handbook

## Purpose

Single-file reference for the Pulse OS v2 codebase. Covers product model, architecture, agent system, workflow engine, and development conventions.

## Detailed Documentation Index

For comprehensive coverage, see the dedicated docs:

| Area | Document | What It Covers |
|------|----------|----------------|
| Product | [Product Overview](product/overview.md) | What Pulse is, 18-step workflow, key concepts, credit costs |
| API | [API Reference](architecture/api-reference.md) | Complete REST endpoints for all 11 controllers |
| Dependencies | [Dependencies](architecture/dependencies.md) | All packages, env variables, external services |
| Workflows | [Workflows](features/workflows.md) | Agent pipeline, step states, dependency graph |
| Keywords | [Keywords](features/keywords.md) | Keyword lifecycle, intent, funnel stages |
| Content | [Content](features/content.md) | Briefs, articles, scoring framework |
| Reports | [Reports](features/reports.md) | PDF generation, templates, download flow |
| Topical Maps | [Topical Maps](features/topical-maps.md) | Pillar → cluster → keyword hierarchy |
| Integrations | [Integrations](features/integrations.md) | 8 external services, retry logic, tool registry |
| Auth | [Auth & Orgs](features/auth.md) | Clerk SSO, webhooks, idempotency |
| Credits | [Credits](features/credits.md) | Credit system, ledger, debit flow |
| Changelog | [Changelog](changelog.md) | All fixes and updates with evidence |

---

## Product Summary

| Item | Description |
|------|-------------|
| Product name | Pulse OS |
| Category | Agent-led SEO/GEO/AEO strategy consultant OS |
| Core promise | Turn raw domain data into approved keyword strategies, topical maps, and production content via 18 guided agent steps with human approval |
| Target user | SEO agencies and in-house SEO teams |
| Differentiator | AI agents execute research + analysis; humans approve at every checkpoint |
| Multi-tenancy | Organization → Workspace (client) → Project (domain) → Workflow Run |

## Product Model

```
Organization (agency)
  └── Workspace (client)
       └── Project (domain)
            └── Workflow Run (18 steps)
                 └── Steps → Artifacts → Approvals
```

## 18-Step Workflow

### Phase 1: Intelligence & Audit (Steps 1-8) — THE MOAT

| Step | Key | Name | Source |
|------|-----|------|--------|
| 1 | `business-profile` | Discovery & Profiling | Enhanced with Firecrawl |
| 2 | `seed-keywords` | Seed Keywords | Battle-tested workflow |
| 3 | `site-audit` | Site Audit (GEO + SEO) | GEO citability + technical SEO |
| 4 | `ai-intelligence` | AI Search Intelligence | Brand Radar + DataForSEO |
| 5 | `serp-niche-map` | SERP & Niche Map | SERP analysis |
| 6 | `competitor-buckets` | Competitor Identification | Classification |
| 7 | `competitor-metrics` | Competitor Metrics | Enhanced with AI SoV |
| 8 | `search-demand` | Search Demand & Seasonality | DataForSEO + Ahrefs |

### Phase 2: Keyword Research (Steps 9-13) — Preserved workflow

| Step | Key | Name |
|------|-----|------|
| 9 | `phase1-baseline` | Client Baseline |
| 10 | `method01-competitor-pages` | Method 01 — Competitor Pages |
| 11 | `method02-seed-expansion` | Method 02 — Seed Expansion |
| 12 | `method03-content-gap-import` | Method 03 — Content Gap (Manual) |
| 13 | `consolidated-keywords` | Consolidation |

### Phase 3: Strategy & Planning (Steps 14-15)

| Step | Key | Name |
|------|-----|------|
| 14 | `verdict-strategy` | Verdict & Strategy |
| 15 | `topical-map` | Topical Map & Content Calendar |

### Phase 4: Content Production (Steps 16-18)

| Step | Key | Name |
|------|-----|------|
| 16 | `content-brief` | Content Briefs |
| 17 | `content-article` | Content Generation & Scoring |
| 18 | `content-images` | Image Generation & Assets |

### Step Dependency Graph

```
Step 1 → Step 2 → Step 3 (parallel with Step 5)
                   Step 3 → Step 4
                   Step 5 → Step 6
                   Step 4 + Step 6 → Step 7
                   Step 8 (parallel with Step 7)
Step 7 + Step 8 → Step 9 → Step 10 (parallel with Step 11)
                             Step 12 (manual, anytime after Step 9)
                   Step 10 + Step 11 + Step 12 → Step 13
Step 13 → Step 14 → Step 15 → Step 16 → Step 17 → Step 18
```

---

## Architecture Overview

### Agent-Led Design

- **Orchestrator** = deterministic code (BullMQ + NestJS): step sequencing, dependency gates, credit metering, data persistence
- **Executors** = AI agents (one per step): interpret data, classify, synthesize, score, generate
- **No frameworks**: Custom ~200-line execution loop using OpenAI function calling API
- Each agent has: system prompt (`.agent.md`), tool permissions, output schema, max iterations, credit cost

### Runtime Topology

| Layer | Technology | Port | Responsibility |
|-------|-----------|------|----------------|
| Frontend | Next.js 15 | 3001 | Dashboard UI, workflow shell |
| Backend | NestJS 10 | 3002 | REST API, WebSocket, agent orchestration |
| Database | PostgreSQL 16 | 5433 | Primary persistence |
| Queue | Redis 7 + BullMQ | 6379 | Background step execution |

### Tech Stack

| Concern | Technology |
|---------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Zustand |
| Auth | Clerk |
| Backend | NestJS 10, Drizzle ORM, BullMQ |
| AI | OpenAI (GPT-4o, function calling) |
| SEO Data | Ahrefs v3 (Site Explorer + Keywords Explorer + Brand Radar) |
| SERP Data | DataForSEO (9 modules), Serper.dev |
| Scraping | Firecrawl |
| Performance | PageSpeed / CrUX |
| Analysis | Server-side utilities (analysis utils) |
| Reports | pdfmake (PDF) |

---

## Repository Layout

```
Pulse/
├── frontend/                  Next.js 15 application
│   └── src/
│       ├── app/               Route tree (App Router)
│       │   └── (dashboard)/   Authenticated routes
│       ├── features/          Feature modules
│       │   ├── workflow/      Workflow shell, renderers, hooks
│       │   ├── workspace/     Workspace management
│       │   ├── project/       Project management
│       │   ├── keywords/      Keyword ledger
│       │   ├── content/       Content editor
│       │   ├── reports/       Report generation
│       │   └── credits/       Credit management
│       └── shared/            Shared UI, hooks, utilities
├── server/                    NestJS 10 API + agent runtime
│   └── src/
│       ├── agents/            Agent runtime engine
│       │   ├── definitions/   18 .agent.md files
│       │   ├── agent.runtime.ts
│       │   ├── agent.registry.ts
│       │   ├── tool.registry.ts
│       │   ├── tool.sandbox.ts
│       │   └── output.validator.ts
│       ├── prompts/           Tunable prompt files (~51 files)
│       │   ├── discovery/
│       │   ├── audit/
│       │   ├── intelligence/
│       │   ├── competitors/
│       │   ├── research/
│       │   ├── strategy/
│       │   ├── topical-map/
│       │   ├── content/
│       │   ├── articles/
│       │   ├── reports/
│       │   └── scoring/
│       ├── db/                Drizzle schema, client, seed
│       ├── features/          Feature modules
│       │   ├── auth/          Clerk webhook + guard
│       │   ├── organizations/ Org CRUD + membership
│       │   ├── credits/       Credit system
│       │   ├── workspaces/    Workspace CRUD
│       │   ├── projects/      Project CRUD
│       │   ├── workflows/     Orchestration, WebSocket, BullMQ
│       │   ├── keywords/      Keyword ledger
│       │   ├── topical-maps/  Topical map storage
│       │   ├── content/       Content CRUD
│       │   ├── reports/       Report generation
│       │   └── integrations/  External API services
│       │       ├── ahrefs/
│       │       ├── dataforseo/
│       │       ├── firecrawl/
│       │       ├── openai/
│       │       ├── pagespeed/
│       │       ├── serper/
│       │       └── gsc/
│       └── shared/            Database module, prompt service, health
├── docs/                      Documentation
├── infra/                     Docker Compose
└── .github/                   Copilot instructions
```

---

## Agent System

### Agent Definition Format (`.agent.md`)

```yaml
---
name: business-profile
step_key: business-profile
model: gpt-4o
temperature: 0.3
max_iterations: 3
credit_cost: 30
depends_on: []
requires_approval: true
---
```

Body sections: Role, Tools Available, Context Provided, Rubrics to Apply, Execution Plan, Output Schema, Guardrails.

### Tool Sandbox

Each agent can only call tools listed in its definition. ~40 tools registered across all integration services. Tool calls are logged to `step_tool_calls` table for audit trail.

### Cost Guardrails

- Credit pre-check before step execution
- Max iterations per agent (typically 3)
- Tool call budget per step
- Output schema validation
- Human approval gates at every checkpoint

### Credit System

| Phase | Steps | Credits |
|-------|-------|---------|
| Phase 1 (Intelligence & Audit) | 1–8 | 365 |
| Phase 2 (Keyword Research) | 9–13 | 220 |
| Phase 3 (Strategy & Planning) | 14–15 | 75 |
| Phase 4 (Content Production) | 16–18 | 80 per content unit |
| Full project (Phases 1–3 + 1 content unit) | | ~740 |

---

## Database Schema (Core Tables)

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant org container |
| `org_members` | User-to-org membership + roles |
| `credit_ledger` | Credit transactions |
| `workspaces` | Client containers within an org |
| `projects` | Domain-level project |
| `workflow_runs` | 18-step workflow execution |
| `workflow_steps` | Individual step state |
| `step_artifacts` | Versioned step output |
| `step_approvals` | Human decisions |
| `step_tool_calls` | Audit trail of API calls |
| `workflow_context` | Accumulated inter-step state |
| `keywords` | Keyword ledger |
| `topical_maps` | Pillar/cluster maps |
| `content_pieces` | Brief/article storage |
| `reports` | Generated PDF reports |

---

## Human-in-the-Loop

Every step has a checkpoint. No agent output flows downstream without approval.

| UI Element | Purpose |
|-----------|---------|
| Artifact Panel | Visualized step output |
| Agent Reasoning | Expandable WHY explanation |
| Tool Call Trail | Every API call logged |
| Approval Bar | [Approve] [Revise] [Reject] + notes |
| Version History | Diff-able artifact versions |

Editable artifacts: Steps 1, 2, 5, 6, 12, 13, 15. Revision re-runs agent with notes injected.

---

## API Surface

### Core Endpoints

| Group | Method | Path | Purpose |
|-------|--------|------|---------|
| Health | GET | `/health` | Service check |
| Auth | POST | `/webhooks/clerk` | Clerk user sync |
| Orgs | CRUD | `/organizations` | Org management |
| Credits | GET | `/credits/balance` | Current balance |
| Credits | GET | `/credits/transactions` | Transaction history |
| Credits | POST | `/credits/purchase` | Add credits |
| Workspaces | CRUD | `/workspaces` | Workspace management |
| Projects | CRUD | `/projects` | Project management |
| Workflows | POST | `/workflows` | Create workflow run |
| Workflows | GET | `/workflows` | List runs |
| Workflows | GET | `/workflows/:id` | Get run + steps |
| Workflows | POST | `/workflows/:id/steps/:key/approve` | Approve step |
| Workflows | POST | `/workflows/:id/steps/:key/revise` | Request revision |
| Workflows | POST | `/workflows/:id/steps/:key/reject` | Reject step |
| Workflows | POST | `/workflows/:id/steps/:key/import` | Manual data import |
| Keywords | GET | `/keywords` | Keyword ledger |
| Keywords | POST | `/keywords/bulk-import` | Bulk import |
| Content | CRUD | `/content` | Content management |
| Reports | POST | `/reports/generate` | Generate PDF |
| Reports | GET | `/reports` | List reports |
| Reports | GET | `/reports/:id/download` | Download PDF |

---

## Design System

Dark workstation UI (Linear/Vercel/Bloomberg Terminal aesthetic).

| Token | Value |
|-------|-------|
| Shell background | `#0A0A0B` |
| Sidebar | `#111113` |
| Content area | `#18181B` |
| Elevated panels | `#1F1F23` |
| Accent | rose-600 `#E11D48` |
| Typography | Inter (primary), JetBrains Mono (data) |
| Density | 13px body, 12px tables, 11px headers |

Layout: 48px top bar, 56px icon rail (expands to 240px), fluid content. Workflow: 280px step rail + artifact panel.

Keyboard-first: ⌘K command palette, J/K navigation, A/R/E approval shortcuts.

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run infra:up` | Start Postgres + Redis containers |
| `npm run infra:down` | Stop containers |
| `npm run infra:reset` | Destroy volumes and restart fresh |
| `npm run db:push` | Push Drizzle schema |
| `npm run db:generate` | Generate migration |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed dev data |
| `npm run dev` | Run frontend + server |
| `npm run typecheck` | TypeScript check both packages |
| `npm run format` | Format all files |
