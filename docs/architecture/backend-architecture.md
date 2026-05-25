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
│   ├── managed-agent.runtime.ts  Anthropic managed agent execution
│   ├── agent.registry.ts      Load/cache agent definitions
│   ├── skill.service.ts       Maps agent skills to pipeline executors
│   ├── tool.registry.ts       Register ~40 tools from integration services
│   ├── tool.bootstrap.ts      Registers all tools at startup
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

### Managed Agent Architecture

```
WorkflowProcessor (BullMQ)
  → AgentRegistry.getAgent(stepKey) → AgentDefinition
  → SkillService.execute(definition, context):
      ├── pipeline-only:       Run data pipeline, return output directly
      ├── pipeline-then-agent: Run pipeline → pass to ManagedAgentRuntime
      ├── agent-with-tools:    ManagedAgentRuntime with tool calling
      └── agent-only:          ManagedAgentRuntime (minimal pipeline)
  → ManagedAgentRuntime:
      └── Anthropic API (claude) with tool-calling loop
```

### Execution Types

| Type | Pipeline | Agent | Use Case |
|------|----------|-------|----------|
| `pipeline-only` | ✅ | ❌ | Deterministic batch API calls (competitor-metrics, search-demand) |
| `pipeline-then-agent` | ✅ | ✅ | Data gathering + synthesis (business-profile, seed-keywords, phase1-baseline) |
| `agent-with-tools` | ❌ | ✅ (tools) | Discovery agents needing real-time data (site-audit, ai-intelligence) |
| `agent-only` | ❌ | ✅ | Pure synthesis/consolidation (consolidated-keywords, verdict-strategy) |

### Execution Flow

```
1. BullMQ dequeues step job
2. Credit pre-check (sufficient balance?)
3. Load agent definition (.agent.md)
4. Load system prompt (.prompt.md) + rubrics
5. Hydrate context from previous step artifacts
6. Route by execution_type:
   - pipeline-only: Execute pipeline (no LLM call), return output
   - pipeline-then-agent: Execute pipeline → build context → call Anthropic managed agent
   - agent-with-tools: Call Anthropic managed agent with tool-calling loop
   - agent-only: Call Anthropic managed agent with context only
7. Validate output against schema
8. Persist artifact (versioned) + reasoning
9. Log all tool calls to step_tool_calls
10. Debit credits (only on verified success)
11. Emit WebSocket event (step complete / awaiting approval)
12. On final failure: capture to dlq_failed_steps
```

### Agent Definition Format

YAML frontmatter in `.agent.md`:
```yaml
---
name: Technical SEO Auditor
step_key: site-audit
execution_type: agent-with-tools
managed_agent_id: agent_01FFVEzvSFoTPhF1BXFC2Ye8
skill: technical-seo-auditing
tools:
  - firecrawl_crawl
  - firecrawl_map_site
  - pagespeed_analyze
  - pagespeed_crux
  - dataforseo_onpage_task
  - dataforseo_onpage_summary
  - return_output
depends_on:
  - business-profile
credit_cost: 60
requires_approval: true
---
```

Fields:
- `execution_type`: `pipeline-only` | `pipeline-then-agent` | `agent-with-tools` | `agent-only`
- `managed_agent_id`: Anthropic managed agent ID (omitted for `pipeline-only`)
- `skill`: Maps to pipeline executor in SkillService
- `tools`: Sandboxed tool allowlist (agent can only call these)
- `depends_on`: Step keys that must complete before this step runs
- `credit_cost`: Credits debited on successful execution
- `requires_approval`: Whether step enters `awaiting_approval` state

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
