# Feature: API Cost Tracking

## Overview

Every outbound API call made by the backend is logged with provider, model/endpoint, token counts, and computed USD cost. This provides full spend visibility across organizations, projects, and workflow runs. An admin-only dashboard surfaces the data with filtering and CSV export.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/api-usage/api-usage.service.ts` | Insert logs, query summaries (by provider/project/run/day) |
| `server/src/features/api-usage/api-usage-context.service.ts` | AsyncLocalStorage context — thread orgId/projectId/runId to integrations |
| `server/src/features/api-usage/pricing.constants.ts` | Hardcoded USD price tables per provider and model |
| `server/src/features/api-usage/api-usage.module.ts` | NestJS module |
| `server/src/features/internal/internal.controller.ts` | Admin API endpoints for cost queries |
| `frontend/src/features/admin/components/api-costs-panel.tsx` | Admin dashboard cost panel |

## How It Works

API cost tracking uses **AsyncLocalStorage** to propagate context (orgId, projectId, runId, stepKey) from the entry point of any operation down through all nested integration service calls — without passing context explicitly through every function signature.

### Context Entry Points

| Entry Point | Coverage |
|-------------|----------|
| `WorkflowProcessor.process()` | All 18 pipeline steps (all integration calls) |
| `BusinessProfileService.refresh()` | Firecrawl, Ahrefs, Serper, Anthropic, OpenAI calls in profile generation |
| `OnDemandAgentsService.run()` | Anthropic calls in on-demand agent chat |
| `ContentService.searchForumThreads()` | DataForSEO Reddit SERP for forum intelligence |

### Instrumented Providers

| Provider | What's tracked |
|----------|---------------|
| Anthropic | Input/output tokens + model-based pricing |
| OpenAI | Input/output tokens + model-based pricing |
| Ahrefs | Per-call pricing (fixed rate per method) |
| DataForSEO | Per-call pricing |
| Serper | Per-call pricing |
| Firecrawl | Per-call pricing |
| PageSpeed | Per-call pricing |
| Perplexity | Scaffolded — service exists, not yet wired to prompt visibility |

### Pricing Tables

Prices are defined in `pricing.constants.ts`. **To update rates: edit the file and redeploy.** No migration needed.

```
ANTHROPIC:  claude-opus-4-6 → $15/$75 per MTok in/out
            claude-sonnet-4-6 → $3/$15 per MTok in/out
OPENAI:     gpt-4o → $2.50/$10.00 per MTok
            gpt-4o-mini → $0.15/$0.60 per MTok
(per-call providers: Ahrefs, DataForSEO, Serper, Firecrawl, PageSpeed have fixed per-call USD rates)
```

## API Endpoints

All under `/internal` — requires `ClerkGuard` + `SuperAdminGuard`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/internal/api-usage` | Summary: total cost/calls, by-provider, by-day (`?orgId`, `?from`, `?to`) |
| `GET` | `/internal/api-usage/by-project` | Cost breakdown per project |
| `GET` | `/internal/api-usage/by-run/:runId` | Cost per step for a specific workflow run |
| `GET` | `/internal/api-usage/export` | CSV export |

## Data Model

### api_usage_logs

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations (CASCADE on delete) |
| project_id | uuid | FK → projects (SET NULL on delete, nullable) |
| workflow_run_id | uuid | FK → workflow_runs (SET NULL on delete, nullable) |
| step_key | text | Pipeline step key (nullable) |
| provider | text | `anthropic`, `openai`, `ahrefs`, `dataforseo`, `serper`, `firecrawl`, `pagespeed`, `perplexity` |
| endpoint | text | API endpoint or model name (e.g., `claude-opus-4-6`, `/keywords_for_site`) |
| tokens_in | integer | Input tokens — LLM calls only (nullable) |
| tokens_out | integer | Output tokens — LLM calls only (nullable) |
| request_count | integer | Default 1; batch calls can set higher |
| cost_usd | numeric(10,6) | Computed USD cost |
| duration_ms | integer | Call duration (nullable) |
| success | boolean | Default true; false if the call threw an error |
| created_at | timestamp | |

**Indexes:**
- `(organization_id, created_at)` — org-level time-range queries
- `(project_id, created_at)` — project drill-downs
- `(workflow_run_id, step_key)` — per-run per-step breakdown

## Frontend

Admin dashboard at `/admin` → "API Costs" tab (`api-costs-panel.tsx`):
- Date range picker (default last 30 days)
- Org filter (super-admins can view all orgs or filter to one)
- Summary card: total cost + total calls
- Provider breakdown table
- Project cost table (click to drill into runs)
- Run-level detail (cost per step)
- CSV export button

## Important Notes

- **Cost is approximate** — computed from hardcoded price constants, not provider invoices
- Costs are logged even if the API call returns an error (`success: false`)
- AsyncLocalStorage context is best-effort — calls made outside the instrumented entry points will log with `project_id = null`
