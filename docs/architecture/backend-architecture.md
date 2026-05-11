# Backend Architecture — Pulse OS

## Overview

NestJS 10 application serving REST API, WebSocket gateway, agent runtime, and BullMQ workers.

## Module Structure

```
server/src/
├── main.ts                    Bootstrap, CORS, Swagger, ValidationPipe
├── app.module.ts              Root module composition
├── agents/                    Agent runtime engine
│   ├── definitions/           17 .agent.md files (one per workflow step)
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
│   ├── workspaces/            Workspace CRUD
│   ├── projects/              Project CRUD
│   ├── workflows/             Orchestration engine
│   │   ├── workflow.module.ts
│   │   ├── workflow.controller.ts
│   │   ├── workflow.service.ts
│   │   ├── workflow.processor.ts   (BullMQ worker)
│   │   └── workflow.gateway.ts     (WebSocket)
│   ├── keywords/              Keyword ledger
│   ├── topical-maps/          Topical map storage
│   ├── content/               Content CRUD
│   ├── reports/               Report generation
│   └── integrations/          External API services
│       ├── ahrefs/            Site Explorer + Keywords Explorer + Brand Radar
│       ├── dataforseo/        9 module endpoints
│       ├── firecrawl/         Web scraping
│       ├── openai/            Chat completions + function calling
│       ├── pagespeed/         PageSpeed + CrUX
│       ├── serper/            SERP results
│       └── gsc/               Google Search Console (via sidecar)
└── shared/
    ├── database/              DatabaseModule (Drizzle provider)
    ├── prompt/                PromptService (file loader + cache)
    ├── health/                HealthController
    └── types/                 Shared TypeScript types
```

## Agent Runtime

### Execution Flow

```
1. BullMQ dequeues step job
2. Credit pre-check (sufficient balance?)
3. Load agent definition (.agent.md)
4. Load system prompt (.prompt.md) + rubrics
5. Hydrate context from previous step artifacts
6. Execute loop:
   a. Call OpenAI with function calling
   b. If tool_call → validate against sandbox → execute → append result
   c. If content → validate against output schema
   d. Repeat until complete or max_iterations reached
7. Persist artifact (versioned)
8. Log all tool calls to step_tool_calls
9. Debit credits
10. Emit WebSocket event (step complete / awaiting approval)
```

### Agent Definition Format

YAML frontmatter in `.agent.md`:
```yaml
---
name: business-profile
step_key: business-profile
model: gpt-4o
temperature: 0.3
max_iterations: 3
credit_cost: 50
depends_on: []
requires_approval: true
tools:
  - firecrawl.scrape
  - serper.search
  - openai.analyze
---
```

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
2. Handles rate limiting internally
3. Caches responses where appropriate
4. Exposes tools that agents can call via tool registry
5. Logs all calls for audit trail
