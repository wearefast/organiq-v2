# Backend Architecture — Pulse OS

## Overview

NestJS 10 application serving REST API, WebSocket gateway, agent runtime, and BullMQ workers.

## Module Structure

```
server/src/
├── main.ts                    Bootstrap, CORS, Swagger, ValidationPipe
├── app.module.ts              Root module composition
├── agents/                    Agent runtime engine
│   ├── definitions/           18 .agent.md files (one per workflow step)
│   ├── agent.runtime.ts       Execution loop (~200 LOC)
│   ├── agent.registry.ts      Load/cache agent definitions
│   ├── tool.registry.ts       Register ~40 tools from integration services
│   ├── tool.sandbox.ts        Per-agent tool access control
│   └── output.validator.ts    JSON Schema validation of agent output
├── prompts/                   Tunable prompt files (~51 files)
│   ├── discovery/             Steps 1-2
│   ├── audit/                 Step 3
│   ├── intelligence/          Steps 4, 8
│   ├── competitors/           Steps 5-7
│   ├── research/              Steps 9-13
│   ├── strategy/              Step 14
│   ├── topical-map/           Step 15
│   ├── content/               Step 16
│   ├── articles/              Step 17
│   ├── reports/               PDF templates
│   └── scoring/               Rubrics
├── db/                        Drizzle schema + client
│   ├── schema.ts              All table definitions
│   ├── index.ts               DB client export
│   └── seed.ts                Dev seed script
├── features/
│   ├── auth/                  Clerk webhook + ClerkGuard
│   ├── organizations/         Org CRUD + membership
│   ├── credits/               Balance, transactions, pre-check
│   ├── billing/               Stripe subscriptions, credit packs, webhooks
│   ├── workspaces/            Workspace CRUD
│   ├── projects/              Project CRUD
│   ├── workflows/             Orchestration engine
│   │   ├── workflow.module.ts
│   │   ├── workflow.controller.ts
│   │   ├── workflow.service.ts
│   │   ├── workflow.processor.ts   (BullMQ worker)
│   │   └── workflow.gateway.ts     (WebSocket)
│   ├── on-demand-agents/      Natural-language ad-hoc agents
│   ├── scheduled-workflows/   Cron-based recurring agents + retention
│   ├── keywords/              Keyword ledger
│   ├── topical-maps/          Topical map storage
│   ├── content/               Content CRUD
│   ├── reports/               Report generation + PDF (pdfmake)
│   │   └── pdf/               PdfGeneratorService
│   ├── notifications/         Org notifications
│   ├── llm-traffic/           LLM traffic session analytics
│   ├── audit/                 LLM audit results
│   ├── prompt-visibility/     Prompt tracking + visibility results
│   └── integrations/          External API services
│       ├── ahrefs/            Site Explorer + Keywords Explorer + Brand Radar
│       ├── anthropic/         Claude Messages API + extended thinking
│       ├── dataforseo/        9 module endpoints
│       ├── firecrawl/         Web scraping
│       ├── openai/            Chat completions + function calling
│       ├── pagespeed/         PageSpeed + CrUX
│       ├── serper/            SERP results
│       └── gsc/               Google Search Console
└── shared/
    ├── database/              DatabaseModule (Drizzle provider)
    ├── prompt/                PromptService (file loader + cache)
    ├── health/                HealthController
    ├── config/                Env validation
    └── types/                 Shared TypeScript types
```

## Agent Runtime

### Provider Adapter Pattern

```
AgentRuntime
  ├── resolveProvider(config) → LlmProvider
  │     ├── AGENT_PROVIDER_OVERRIDE env (takes precedence)
  │     ├── config.provider from .agent.md frontmatter
  │     └── default: 'openai'
  │
  ├── OpenAiProvider (wraps OpenAiService)
  │     └── complete() / completeTier2()
  │
  └── AnthropicProvider (wraps AnthropicService)
        └── complete() / completeTier2() (with extended thinking)
```

### Tier-Based Routing

| Tier | Execution Path | Use Case |
|------|---------------|----------|
| Tier 1 | Pipeline (no LLM) | Deterministic batch API calls |
| Tier 2 | Single-shot, no tool loop | Synthesis/consolidation with extended thinking |
| Tier 3 | Full tool-calling loop | Discovery agents needing real-time data |

### Execution Flow

```
1. BullMQ dequeues step job
2. Credit pre-check (sufficient balance?)
3. Load agent definition (.agent.md)
4. Load system prompt (.prompt.md) + rubrics
5. Hydrate context from previous step artifacts
6. Resolve LLM provider (env override > frontmatter > default)
7. Route by tier:
   - Tier 1: Execute pipeline (no LLM call)
   - Tier 2: Single-shot provider.completeTier2() (thinking enabled)
   - Tier 3: Execute loop with tool calling
8. Persist artifact (versioned) + metadata (provenance, thinking trace)
9. Log all tool calls to step_tool_calls
10. Debit credits (only on verified success)
11. Emit WebSocket event (step complete / awaiting approval)
12. On final failure (3 attempts): capture to DLQ
```

### Agent Definition Format

YAML frontmatter in `.agent.md`:
```yaml
---
name: consolidated-keywords
step_key: consolidated-keywords
model: claude-opus-4-20250514
temperature: 1
max_iterations: 1
credit_cost: 150
depends_on:
  - method01-competitor-pages
  - method02-seed-expansion
requires_approval: true
tools:
provider: anthropic
tier: tier2
thinking_budget: 32000
---
```

New fields (backward-compatible — all optional):
- `provider`: `openai` | `anthropic` (default: openai)
- `tier`: `tier1` | `tier2` | `tier3` (default: inferred from tools presence)
- `thinking_budget`: Token budget for extended thinking (Anthropic only)

## Workflow Orchestration

### Step States

```
PENDING → RUNNING → COMPLETED → (downstream steps unlocked)
                  → AWAITING_APPROVAL → APPROVED → (downstream)
                                      → REVISION_REQUESTED → RUNNING (re-execute)
                                      → REJECTED → FAILED
                  → FAILED (retry available)
```

### Dependency Resolution

Steps only execute when ALL `depends_on` steps are in `APPROVED` or `COMPLETED` state. The workflow service resolves the dependency graph and enqueues ready steps to BullMQ.

## API Conventions

- All routes prefixed with feature group
- ValidationPipe with whitelist + transform
- ClerkGuard on all authenticated routes
- Swagger at `/docs`
- Standardized error responses with NestJS exception filters

## Integration Services Pattern

Each integration service:
1. Wraps external API with typed methods
2. Handles rate limiting internally (exponential backoff retries)
3. Caches responses where appropriate
4. Exposes tools that agents can call via tool registry
5. Logs all calls for audit trail

## Observability

### Structured Logging (Pino)
- JSON format in production, pretty-printed in dev
- `correlationId` per HTTP request (from `x-correlation-id` header or auto-generated UUID)
- Health endpoint excluded from auto-logging
- BullMQ job lifecycle events logged (active, completed, failed, stalled)

### Dead Letter Queue (DLQ)
- Table: `dlq_failed_steps`
- Captures jobs that exhaust all BullMQ retry attempts (default: 3)
- Stores: stepKey, error, attemptCount, full jobData
- Admin endpoints:
  - `GET /admin/dlq` — list unresolved failures
  - `POST /admin/dlq/:id/replay` — re-enqueue job
  - `POST /admin/dlq/:id/dismiss` — mark resolved without replay

## Testing

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Vitest | Individual services/controllers |
| Integration | Vitest + Supertest | Full NestJS app with mock providers |
| E2E | Playwright (frontend) | Browser-based golden paths |

Config: `server/vitest.config.ts`, test helpers in `server/src/test/`
