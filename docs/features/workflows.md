# Feature: Workflow Engine

## Overview

The workflow engine is the core of Pulse OS. It orchestrates an 18-step AI agent pipeline that takes a business domain from initial discovery through keyword research, competitor analysis, topical mapping, content generation, and strategic recommendations.

## Architecture

```
User triggers "Start Run" on a project
  → WorkflowController.startRun()
    → WorkflowService.startRun()
      → BullMQ enqueues step jobs based on dependency graph
        → WorkflowProcessor picks up jobs
          → AgentRuntime.execute() runs the agent
            → Agent calls tools (Ahrefs, DataForSEO, etc.)
            → Agent produces JSON output
          → OutputValidator validates the output
          → Step artifact is stored
          → If step requires approval → status = awaiting_approval
          → If no approval needed → next dependent steps are enqueued
            → WebSocket emits step progress to frontend
```

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/workflows/workflow.controller.ts` | REST API (create, start, approve, revise, reject) |
| `server/src/features/workflows/workflow.service.ts` | Business logic (run management, step orchestration) |
| `server/src/features/workflows/workflow.processor.ts` | BullMQ job processor (executes agent per step) |
| `server/src/features/workflows/workflow.gateway.ts` | WebSocket gateway for real-time step updates |
| `server/src/features/workflows/workflow-queue-listener.service.ts` | BullMQ event logger (job lifecycle observability) |
| `server/src/features/workflows/dlq.service.ts` | Dead letter queue (capture/replay/dismiss failed jobs) |
| `server/src/features/workflows/dlq.controller.ts` | DLQ admin endpoints |
| `server/src/features/workflows/workflow.module.ts` | NestJS module registration |
| `server/src/agents/agent.runtime.ts` | Agent execution loop with provider routing |
| `server/src/agents/agent.registry.ts` | Loads agent definitions from `.agent.md` files |
| `server/src/agents/llm-provider.interface.ts` | LlmProvider interface (OpenAI + Anthropic) |
| `server/src/agents/openai.provider.ts` | OpenAI adapter |
| `server/src/agents/anthropic.provider.ts` | Anthropic adapter (with extended thinking) |
| `server/src/agents/tool.registry.ts` | Available tools registry |
| `server/src/agents/tool.sandbox.ts` | Sandboxed tool execution |
| `server/src/agents/output.validator.ts` | JSON output schema validation |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/workflows` | Create a new workflow run for a project |
| `POST` | `/workflows/:id/start` | Start executing the workflow |
| `GET` | `/workflows/:id` | Get run detail with all steps |
| `GET` | `/workflows/project/:projectId` | List all runs for a project |
| `POST` | `/workflows/:id/steps/:stepKey/approve` | Approve a step's output |
| `POST` | `/workflows/:id/steps/:stepKey/revise` | Request revision on a step |
| `POST` | `/workflows/:id/steps/:stepKey/reject` | Reject a step's output |

## Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/workspaces/:wId/projects/:pId/workflows` | Workflow runs list | Shows all runs with status badges |
| `/workspaces/:wId/projects/:pId/workflows/:runId` | Run detail | Step-by-step view with artifacts, approval buttons, real-time progress |

## Step Dependency Graph

Steps only execute after their dependencies complete. The dependency graph is defined in each `.agent.md` file's YAML frontmatter via the `dependencies` field.

```
Phase 1 — Intelligence & Audit (Steps 1–8):
  Step 1: business-profile (no deps)
  Step 2: seed-keywords ← business-profile
  Step 3: site-audit ← business-profile
  Step 4: ai-intelligence ← site-audit
  Step 5: serp-niche-map ← seed-keywords
  Step 6: competitor-buckets ← serp-niche-map
  Step 7: competitor-metrics ← ai-intelligence + competitor-buckets
  Step 8: search-demand ← seed-keywords

Phase 2 — Keyword Research (Steps 9–13):
  Step 9:  phase1-baseline ← competitor-metrics + search-demand
  Step 10: method01-competitor-pages ← phase1-baseline
  Step 11: method02-seed-expansion ← phase1-baseline
  Step 12: method03-content-gap-import ← phase1-baseline (manual)
  Step 13: consolidated-keywords ← method01 + method02 + method03

Phase 3 — Strategy & Planning (Steps 14–15):
  Step 14: verdict-strategy ← consolidated-keywords
  Step 15: topical-map ← verdict-strategy

Phase 4 — Content Production (Steps 16–18):
  Step 16: content-brief ← topical-map
  Step 17: content-article ← content-brief
  Step 18: content-images ← content-article
```

## Agent Definition Format

Each agent is defined as a `.agent.md` file in `server/src/agents/definitions/`:

```yaml
---
name: seed-keywords
step_key: seed-keywords
model: claude-opus-4
provider: anthropic
tier: 3
thinking_budget: 32000
temperature: 0.3
credit_cost: 40
max_iterations: 5
dependencies: []
required_approval: true
tools:
  - ahrefs_keyword_volume
  - serper_search
---

# Seed Keywords Agent

You are an SEO keyword research specialist...
[agent instructions in markdown]
```

## Tier Routing

Steps are classified into 3 execution tiers:

| Tier | Provider | Description | Examples |
|------|----------|-------------|----------|
| Tier 1 | Pipeline (code) | No LLM — direct API calls + data transform | competitor-metrics, search-demand, method01-03 |
| Tier 2 | Anthropic (thinking) | Single-shot with extended thinking, no tools | consolidated-keywords, verdict-strategy, topical-map |
| Tier 3 | Anthropic (tools + thinking) | Full tool loop with extended thinking | phase1-baseline, seed-keywords, content-brief, content-article, site-audit |

Routing logic in `WorkflowProcessor`:
1. `tier: tier1` → `PipelineService.execute()` (no LLM, deterministic)
2. `tier: tier2` → `AgentRuntime.executeTier2()` → `provider.completeTier2()`
3. `tier: tier3` (or default) → `AgentRuntime.execute()` → full tool loop

## Verification Service

Post-execution quality checks before credit debit (`server/src/shared/verification/`).

| Rule | Step | Checks |
|------|------|--------|
| `consolidated-keywords-integrity` | consolidated-keywords | Count matches stats, no duplicates, required fields, valid intents/funnels |
| `verdict-strategy-integrity` | verdict-strategy | Required sections exist (SWOT, verdict, priorityMatrix, actionPlan, KPIs) |
| `topical-map-integrity` | topical-map | Pillars with clusters and pages, calendar non-empty, linking architecture |

On failure: up to 2 free retries with feedback before proceeding.

## Shadow Mode

Env: `SHADOW_MODE_STEPS=verdict-strategy,topical-map,phase1-baseline`

Runs the opposite provider in parallel, compares structural output, stores `shadowVerdictIfAny` in artifact metadata. Shadow failures never block the primary path.

## Pipelines (Tier 1)

Located in `server/src/features/workflows/pipelines/`:

| Pipeline | Step Key | Description |
|----------|----------|-------------|
| CompetitorMetricsPipeline | competitor-metrics | Batch Ahrefs domain rating, backlinks, keywords |
| SearchDemandPipeline | search-demand | Batch volume + difficulty from DataForSEO/Ahrefs |
| Method01CompetitorPagesPipeline | method01-competitor-pages | Top organic pages per competitor |
| Method02SeedExpansionPipeline | method02-seed-expansion | Related keywords + suggestions expansion |
| Method03ContentGapPipeline | method03-content-gap-import | Set-difference gap analysis |

## Analysis Utilities

Ported from Python sidecar to `server/src/shared/analysis/`:

| Utility | Description |
|---------|-------------|
| `citability.util.ts` | HTML citability scoring (schema, FAQ, tables, etc.) |
| `pagespeed-parser.util.ts` | Lighthouse JSON → normalized metrics |
| `keyword-scoring.util.ts` | Opportunity score formula |
| `opportunity-filter.util.ts` | Threshold-based keyword filtering |
| `competitor-gaps.util.ts` | Set difference for content gaps |
| `brand-mentions.util.ts` | Regex-based brand mention detection |

## Data Model

### workflow_runs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| projectId | UUID | FK → projects |
| organizationId | UUID | FK → organizations |
| status | enum | draft, running, paused, completed, failed |
| currentStep | text | Currently executing step key |
| creditsUsed | integer | Total credits consumed |
| startedAt | timestamp | When execution began |
| completedAt | timestamp | When execution finished |

### workflow_steps
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| workflowRunId | UUID | FK → workflow_runs |
| stepKey | text | Agent step identifier |
| stepNumber | integer | Execution order |
| phase | integer | Phase grouping (1-4) |
| status | enum | pending, running, completed, awaiting_approval, etc. |
| creditsUsed | integer | Credits consumed by this step |
| iterations | integer | Agent loop iterations used |
| error | text | Error message if failed |

### step_artifacts
Stores the JSON output of each agent execution per step.

### step_approvals
Records human review decisions (approved, revision_requested, rejected) with reviewer ID and notes.

### step_tool_calls
Logs every tool invocation by the agent (tool name, input, output, duration, success/failure).

### workflow_context
Key-value store for passing data between steps within a run.

---

## On-Demand Agents (R8)

User-prompted AI agents that analyze project data and provide actionable recommendations in a chat-style interface.

### Architecture

```
User Prompt → Agent Router (classify intent → agent type)
  → Context Builder (fetch relevant DB data)
    → LLM Call (GPT-4o with structured data)
      → Response Parser → Agent Response (recommendations + cited data)
```

### Agent Types

| Type | Label | Credit Cost | Data Sources |
|------|-------|-------------|--------------|
| `content-refresh` | Content Refresh Analyzer | 5 | GSC declining pages + keyword decay alerts |
| `ai-search-visibility` | AI Search Visibility Auditor | 5 | Prompt visibility results + LLM traffic |
| `technical-issues` | Technical Issues Summarizer | 3 | LLM audit results |
| `keyword-opportunity` | Keyword Opportunity Finder | 5 | High-impression low-CTR keywords + prompt gaps |
| `google-vs-ai` | Google vs AI Search Comparator | 4 | GSC traffic + LLM traffic stats |
| `keyword-decay` | Keyword Decay Monitor | 3 | Active keyword decay alerts |
| `competitor-analysis` | Competitor Analysis | 5 | Competitor citations + contested keywords |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/:projectId/agents/run` | Run an on-demand agent |
| `GET` | `/projects/:projectId/agents/history` | Get agent run history |
| `GET` | `/projects/:projectId/agents/types` | List available agent types |

### Key Files

| File | Purpose |
|------|---------|
| `server/src/features/on-demand-agents/on-demand-agents.module.ts` | Module registration |
| `server/src/features/on-demand-agents/on-demand-agents.controller.ts` | REST API |
| `server/src/features/on-demand-agents/on-demand-agents.service.ts` | Agent orchestration (router → context → LLM → credits) |
| `server/src/features/on-demand-agents/agent-router.service.ts` | Keyword-based prompt classification |
| `server/src/features/on-demand-agents/context-builders/*.ts` | Data fetchers per agent type |

### Credit Logic (AD-8)

- Credits are pre-checked before execution.
- Credits are only debited on successful completion.
- Failed runs are NOT charged.

### Frontend

| Route | Component |
|-------|-----------|
| `/workspaces/:wId/projects/:pId/agents` | `AgentChat` — chat interface with quick-start prompts |

---

## Scheduled Workflows (R9)

Automated agent runs on a cron schedule with delivery to Slack or email.

### Architecture

```
WorkflowSchedulerService → BullMQ repeatable job (every 5 min)
  → WorkflowSchedulerProcessor.process()
    → Find due workflows (nextRunAt <= now)
      → For each: OnDemandAgentsService.run()
        → DeliveryService.deliver() (Slack webhook / SendGrid email)
          → Record run history + update nextRunAt
```

### Data Model

#### scheduled_workflows
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| projectId | UUID | FK → projects |
| organizationId | UUID | FK → organizations |
| name | text | Workflow name |
| agentType | text | Agent to run |
| prompt | text | Prompt for the agent |
| scheduleCron | text | Cron expression |
| deliveryChannel | text | 'slack' or 'email' |
| deliveryTarget | text | Webhook URL or email address |
| isActive | boolean | Enable/disable toggle |
| lastRunAt | timestamp | Last execution time |
| nextRunAt | timestamp | Next scheduled execution |

#### workflow_run_history
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| workflowId | UUID | FK → scheduled_workflows |
| projectId | UUID | FK → projects |
| ranAt | timestamp | Execution time |
| status | text | success / failed / partial |
| agentResponse | text | Full agent output |
| delivered | boolean | Whether delivery succeeded |
| errorMessage | text | Error if failed |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/:projectId/scheduled-workflows` | Create workflow |
| `GET` | `/projects/:projectId/scheduled-workflows` | List workflows |
| `GET` | `/projects/:projectId/scheduled-workflows/:id` | Get single workflow |
| `PATCH` | `/projects/:projectId/scheduled-workflows/:id` | Update workflow |
| `DELETE` | `/projects/:projectId/scheduled-workflows/:id` | Delete workflow |
| `GET` | `/projects/:projectId/scheduled-workflows/:id/history` | Run history |

### Pre-built Templates

| Template | Cron | Channel |
|----------|------|---------|
| Weekly AI Search Summary | `0 9 * * 1` | Slack / Email |
| Monthly Content Refresh Report | `0 9 1 * *` | Email |
| Weekly Keyword Decay Alert | `0 9 * * 5` | Slack |
| Technical Issues Digest | `0 9 * * 1` | Email |
| New Content Opportunities | `0 9 1,15 * *` | Email |

### Key Files

| File | Purpose |
|------|---------|
| `server/src/features/scheduled-workflows/scheduled-workflows.module.ts` | Module |
| `server/src/features/scheduled-workflows/scheduled-workflows.service.ts` | CRUD + due-workflow finder |
| `server/src/features/scheduled-workflows/workflow-scheduler.service.ts` | Registers BullMQ repeatable job |
| `server/src/features/scheduled-workflows/workflow-scheduler.processor.ts` | Processes due workflows |
| `server/src/features/scheduled-workflows/delivery.service.ts` | Slack + Email delivery |

### Frontend

| Route | Component |
|-------|-----------|
| `/workspaces/:wId/projects/:pId/scheduled-workflows` | `WorkflowBuilder` — template picker, form, list with toggle |
