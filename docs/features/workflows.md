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

### Run Detail Panels

The run detail page exposes three distinct execution surfaces for each completed step:

| Panel | Source | Behavior |
|-------|--------|----------|
| Artifact renderer | `frontend/src/features/workflow/renderers/` | Step-specific visualization of the structured JSON artifact |
| Agent Reasoning | `step_artifacts.reasoning` | Shows the execution context sent to the agent runtime plus any rationale fields the model returned in structured output |
| Tool Calls | `step_tool_calls` | Shows recorded tool usage in execution order; `pipeline-then-agent` steps also record a synthetic `pipeline.<stepKey>` trace so upstream fetch/extract work is visible in the UI |

Notes:
- The local AgentRuntime uses Claude Messages API with extended thinking. Thinking traces are stored in `step_artifacts.metadata`.
- For agent steps, the reasoning panel shows execution context and model rationale, not hidden internal reasoning.
- For `business-profile`, the artifact renderer uses a structured business-analysis layout instead of the generic fallback field dump.
- For `serp-niche-map`, the renderer shows three summary metrics in a row and places the text-heavy `Top Opportunity` field in a full-width callout below them for readability.

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
name: Seed Keywords Generator
step_key: seed-keywords
execution_type: pipeline-then-agent
depends_on:
  - business-profile
credit_cost: 40
requires_approval: true
---

# Seed Keywords Agent

You are an SEO keyword research specialist...
[agent instructions in markdown]
```

## Execution Types

The workflow runtime routes agent steps by `execution_type` (resolved from `.agent.md` frontmatter).

| execution_type | Behavior |
|----------------|----------|
| `pipeline-only` | Deterministic code path only; no LLM agent |
| `pipeline-then-agent` | Pipeline gathers evidence first, then the local AgentRuntime reasons over the provided `pipeline_data` with no tools |
| `agent-only` | Agent reasons over prior workflow context only, with no tools |
| `agent-with-tools` | Agent receives the configured tools and can call them during execution |

For `seed-keywords`, the current contract is `pipeline-then-agent`: the pipeline gathers organic keywords, extracted seed terms, related terms, and suggestions, and the agent returns the final `seedKeywords` artifact from that provided evidence.

## Tier Routing

Steps are classified into 3 execution tiers:

| Tier | Provider | Description | Examples |
|------|----------|-------------|----------|
| Tier 1 | Pipeline (code) | No LLM — direct API calls + data transform | competitor-metrics, search-demand, method01-03 |
| Tier 2 | Local AgentRuntime (thinking) | Single-shot with extended thinking, no tools | consolidated-keywords, verdict-strategy, topical-map |
| Tier 3 | Local AgentRuntime (tools) | Agent execution with tool-calling capabilities | phase1-baseline, seed-keywords, content-brief, content-article, site-audit |

Routing logic in `WorkflowProcessor`:
1. `executionType: pipeline-only` → `PipelineService.execute()` (no LLM, deterministic)
2. `executionType: agent-only` → `AgentRuntime.execute()` with `allowedTools: []`
3. `executionType: pipeline-then-agent` → run pipeline, pass `pipeline_data` to `AgentRuntime.execute()` with `allowedTools: []`
4. `executionType: agent-with-tools` → `AgentRuntime.execute()` with configured tools

`seed-keywords` uses `pipeline-then-agent`, so the Tool Calls panel shows the synthetic `pipeline.seed-keywords` trace for the upstream fetch work rather than live tool calls from the agent.

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

## Prompt Governance (Console Sync)

Prompts are managed via a hybrid model: source of truth is in the repo (`.agent.md` files), but can be deployed to a Console API for non-engineer iteration.

### Configuration

| Env Var | Values | Description |
|---------|--------|-------------|
| `PROMPT_SOURCE` | `local` (default) / `console` / `hybrid` | Where to resolve prompts at runtime |
| `PROMPT_CONSOLE_URL` | URL | Console API base URL |
| `PROMPT_CONSOLE_API_KEY` | Bearer token | Console API authentication |

### Modes

| Mode | Behavior |
|------|----------|
| `local` | Always reads from `.agent.md` files on disk (default, no Console dependency) |
| `console` | Fetches from Console API; falls back to local on failure |
| `hybrid` | Uses Console if agent has `prompt_id` in frontmatter; otherwise local |

### Agent `prompt_id` Convention

All Tier 2/3 agents have `prompt_id: pulse_<step_key_with_underscores>` in their frontmatter. This ID maps to the Console prompt entry.

| Agent | prompt_id |
|-------|-----------|
| consolidated-keywords | `pulse_consolidated_keywords` |
| verdict-strategy | `pulse_verdict_strategy` |
| topical-map | `pulse_topical_map` |
| content-article | `pulse_content_article` |
| content-brief | `pulse_content_brief` |
| seed-keywords | `pulse_seed_keywords` |
| phase1-baseline | `pulse_phase1_baseline` |
| site-audit | `pulse_site_audit` |
| ai-intelligence | `pulse_ai_intelligence` |
| business-profile | `pulse_business_profile` |
| serp-niche-map | `pulse_serp_niche_map` |
| competitor-buckets | `pulse_competitor_buckets` |

### Sync Scripts

```bash
npm run prompts:sync          # Upserts all .agent.md → Console (versioned by git hash)
npm run prompts:sync --dry-run # Shows what would sync without uploading
npm run prompts:diff          # Shows which prompts differ from Console version
```

### Evaluation Harness

```bash
npm run prompts:eval          # Runs structural rubric tests against mock outputs
```

Located in `server/src/prompts/__eval__/`:
- `eval-framework.ts` — Rubric evaluation engine (exists/array_min/type/contains/custom checks)
- `fixtures.ts` — Synthetic test contexts (consolidated-keywords, verdict-strategy, topical-map)
- `prompt-eval.spec.ts` — 9 eval cases (3 per agent), validates output structure

### Key Files

| File | Purpose |
|------|---------|
| `server/src/shared/prompt/prompt.service.ts` | `fetchFromConsole()`, `loadAgentDefinitionResolved()`, 5-min TTL cache |
| `server/scripts/sync-prompts-to-console.ts` | CI sync script (reads .agent.md, upserts to Console API) |
| `server/src/prompts/__eval__/` | Evaluation harness |

### Rollback

Set `PROMPT_SOURCE=local` to immediately bypass Console and use on-disk prompts.

---

## Pipelines (Tier 1)

Located in `server/src/features/workflows/pipelines/`:

| Pipeline | Step Key | API Calls | Description |
|----------|----------|-----------|-------------|
| CompetitorMetricsPipeline | competitor-metrics | Ahrefs: DR + backlinks + top-keywords × N competitors | Batch competitor metrics. Reads target DR from `context['business-profile']` (no duplicate call). Exposes `keywords[]` per competitor for downstream use. |
| SearchDemandPipeline | search-demand | DataForSEO/Ahrefs volume per keyword | Volume + difficulty batch enrichment |
| Phase1BaselinePipeline | phase1-baseline | 0–1 Ahrefs calls | Reads organic keywords from `context['seed-keywords']` if available (0 Ahrefs calls). Falls back to `getOrganicKeywords` only if context is empty. Always calls `getOrganicPages` (1 call). |
| SerpNicheMapPipeline | serp-niche-map | Ahrefs SERP × ≤20 seeds | Capped at 20 seeds. Reads from `context['seed-keywords'].seedKeywords[]`. |
| Method01CompetitorPagesPipeline | method01-competitor-pages | Ahrefs `getOrganicPages` × N competitors | Top organic pages per competitor. Reads `keywords[]` from `context['competitor-metrics']` — no extra keyword API calls. |
| Method02SeedExpansionPipeline | method02-seed-expansion | **0 API calls** | Passes `seedKeywords[]` from `context['seed-keywords']` directly to the agent. No Ahrefs or DataForSEO calls. |
| Method03ContentGapPipeline | method03-content-gap-import | **0 API calls** (if no imports) | Early gate: if `context['imported-keywords']` is absent or empty, returns empty result schema immediately. API calls only fire when external keyword data has been imported. |

## R12 Cost Optimisations (June 2026)

Release 12 implemented 8 targeted optimisations. All changes are backward-compatible.

### API Deduplication

| Step | Before | After | Saving |
|------|--------|-------|--------|
| method02-seed-expansion | 40+ API calls (Ahrefs + DataForSEO) | **0 calls** — reads from `seed-keywords` context | ~40 credits/run |
| phase1-baseline | 2 API calls (Ahrefs organic keywords + pages) | **1 call** (pages only) — keywords from `seed-keywords` context | ~1 Ahrefs unit/run |
| serp-niche-map | Up to 50 SERP calls | **≤20 calls** — capped at 20 seeds | ~30 SERP credits/run |
| method03-content-gap-import | ~9 API calls | **0 calls** (when no imports) — early gate | ~9 credits when skipped |
| method01-competitor-pages | `getOrganicKeywords` per competitor | **0 keyword calls** — reads from `competitor-metrics` context | ~N credits/run |

### Bug Fixes

| Step | Bug | Fix |
|------|-----|-----|
| competitor-metrics | Target DR read from `.rawData.domainAuthority.domain_rating` (non-existent path) | Fixed to `.domain_authority.domain_rating` (Claude agent output schema) |

### Context Slicing

For three late-stage steps that previously received the full `workflowContext` (all prior step outputs), `workflow.processor.ts` now passes only the declared dependency keys:

| Step | Context Keys Passed |
|------|--------------------|
| consolidated-keywords | `seed-keywords`, `method01-competitor-pages`, `method02-seed-expansion`, `method03-content-gap-import`, `phase1-baseline` |
| verdict-strategy | `business-profile`, `site-audit`, `ai-intelligence`, `competitor-buckets`, `competitor-metrics`, `consolidated-keywords` |
| topical-map | `consolidated-keywords`, `verdict-strategy`, `business-profile` |

Slicing implemented in `AgentRuntimeConfig.contextKeys` → `buildUserMessage()` filter in `agent.runtime.ts`.

### Prompt Corrections

Five prompt files were corrected to match actual runtime execution model (`allowedTools: []` for all `pipeline-then-agent` steps):

| File | Problem | Fix |
|------|---------|-----|
| `research/phase1-baseline.prompt.md` | Listed blocked tool names in execution model | Replaced with pipeline data note |
| `research/method01-competitor-pages.prompt.md` | Rule 1 required keywords from tool responses (tools blocked); step-by-step instructed tool calls; note said keyword data unavailable | All three corrected to reflect actual pipeline data shape including `keywords[]` |
| `research/method02-seed-expansion.prompt.md` | Listed blocked tool names | Updated to reflect `rawData.seedKeywords` pipeline shape |
| `content/content-brief.prompt.md` | Instructions 1–2 called `serper_search`/`firecrawl_scrape`; Task section said "using the available tools" | Redirected to `serpResults`/`scrapedPages` in `<pipeline_data>` |
| `competitors/competitor-metrics.prompt.md` | Labelled as "Agent-with-tools" (it's pipeline-only, prompt never loaded) | Labelled as "Pipeline-only (no LLM) — documentation only" |

---

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
