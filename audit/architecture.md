# Architecture Audit — Pulse OS

> **Last audited:** June 4, 2026 (Release 13 — CTO Deep Audit)
> **Auditor:** CTO / Principal Engineer
> **Branch:** `OS-version1-enhancements`
> **Scope:** Full source-code audit of agent runtime, pipelines, prompts, orchestration, security, performance

---

## 1. System Identity

| Property | Value |
|----------|-------|
| Product | Pulse OS — Agent-led SEO/GEO/AEO strategy platform |
| Runtime model | 18-step guided workflow, human-in-the-loop approval |
| Tenancy | Multi-tenant (Organization → Workspace → Project → Run) |
| Agent framework | Custom (no LangChain/AutoGen) |

---

## 2. Tech Stack — Verified Versions

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | Next.js | 15 | App Router, RSC |
| Frontend state | Zustand | — | Client state only |
| Frontend auth | Clerk | — | JWT, `useAuth` hook |
| Backend | NestJS | 10 | BullMQ workers |
| ORM | Drizzle | — | Schema-first, PostgreSQL |
| Database | PostgreSQL | 16 | Container: `pulse_v2`, port 5433 |
| Queue | Redis + BullMQ | 7 | Port 6379 |
| Primary LLM | Anthropic Claude | `claude-sonnet-4` | Extended thinking enabled |
| Billing | Stripe | — | Subscriptions + credit packs |
| SEO data | Ahrefs v3 | — | 3 API surfaces (Site Explorer, Keywords Explorer, Brand Radar) |
| SERP data | Serper.dev + DataForSEO | — | 9 DataForSEO modules |
| Scraping | Firecrawl | — | Used in business-profile, content-brief pipelines |
| Performance | PageSpeed + CrUX | — | Used in site-audit pipeline |
| Search Console | GSC API | — | Keyword position data |

---

## 3. Runtime Topology

```
Browser (Next.js 15, port 3001)
  │ REST (fetch)
  │ WebSocket
  ▼
NestJS 10 API (port 3002)
  ├── Controllers (REST)
  ├── WebSocket Gateway
  ├── BullMQ Workers (step processor)
  ├── Agent Runtime (Claude Messages API)
  └── PromptService (local .md / Console API)
  │
  ├── PostgreSQL 16 (port 5433, pulse_v2)
  ├── Redis 7 (port 6379)
  └── External Services
        Anthropic · Ahrefs · DataForSEO · Serper · Firecrawl
        PageSpeed/CrUX · GSC · OpenAI · Stripe
```

---

## 4. Repository Structure

```
frontend/    Next.js 15 (App Router)
  src/
    app/          Route tree
    features/     Feature modules (workflow, workspace, project, keywords, content, reports)
    shared/       Reusable UI, shared hooks, utilities

server/      NestJS 10
  src/
    agents/       Agent runtime + definitions (18 .agent.md)
    prompts/      ~51 prompt files (.prompt.md, .rubric.md, .config.md)
    features/     Feature modules
    db/           Drizzle schema + seed
    shared/       Database module, prompt service, health

audit/       Audit snapshots (this directory)
docs/        All product + architecture docs
infra/       Docker Compose (Postgres + Redis)
```

---

## 5. Workflow Architecture — Critical Clarification

**`business-profile` is NOT a workflow step.**
It is a project-level attribute (`projects.business_profile` JSONB column), populated by a separate on-demand analysis action. When a workflow run starts (`startRun()`), the service seeds `business-profile` into the `workflow_context` table from `project.businessProfile`. This means:
1. `business-profile` data can be **stale** (it was generated whenever the user last ran the Business Profile action, not at run time)
2. If a project's domain/market changes between the business profile update and the workflow run, all downstream steps receive outdated context
3. The `agent-flow.md` doc incorrectly lists business-profile as "Step 1" — it is a pre-seeded context value, not an orchestrated step

**Workflow run context bootstrap (in `workflow.service.ts:startRun`):**
```
setContext(runId, 'domain', project.domain)
setContext(runId, 'country', project.country)
setContext(runId, 'language', project.language)
setContext(runId, 'industry', project.industry)
setContext(runId, 'business-profile', project.businessProfile)  ← pre-seeded, not a step
```

---

## 6. Workflow Step Registry (Post-R12)

> **17 steps** (STEP_DEFINITIONS in `workflow.service.ts`). `business-profile` is NOT a step — see §5.

| # | Step Key | Execution Type | Pipeline API Calls | LLM | Approval |
|---|----------|---------------|-------------------|-----|----------|
| 1 | seed-keywords | pipeline-then-agent | Ahrefs organic + related + suggestions | Claude (no tools) | ✅ |
| 2 | site-audit | pipeline-then-agent | PageSpeed + CrUX + Ahrefs | Claude (no tools) | ✅ |
| 3 | ai-intelligence | agent-with-tools | none (agent calls) | Claude (tools) | ✅ |
| 4 | serp-niche-map | pipeline-then-agent | Ahrefs SERP ×≤20 | Claude (no tools) | — |
| 5 | competitor-buckets | pipeline-then-agent | Serper SERP data | Claude (no tools) | ✅ |
| 6 | competitor-metrics | **pipeline-only** | Ahrefs DR+backlinks+keywords ×N; reads target DR from context | none | — |
| 7 | search-demand | **pipeline-only** | DataForSEO/Ahrefs volume batch | none | — |
| 8 | phase1-baseline | pipeline-then-agent | 0–1 Ahrefs calls (organic pages; keywords from context) | Claude (no tools) | ✅ |
| 9 | method01-competitor-pages | pipeline-then-agent | Ahrefs organic pages ×N; keywords from context | Claude (no tools) | — |
| 10 | method02-seed-expansion | pipeline-then-agent | **0** (reads from seed-keywords context) | Claude (no tools) | — |
| 11 | method03-content-gap-import | pipeline-then-agent | **0** (early gate if no imports) | Claude (no tools) | — |
| 12 | consolidated-keywords | **agent-only** | 0 | Claude (extended thinking, context-sliced) | ✅ |
| 13 | verdict-strategy | **agent-only** | 0 | Claude (extended thinking, context-sliced) | ✅ |
| 14 | topical-map | **agent-only** | 0 | Claude (extended thinking, context-sliced + brand filter) | ✅ |
| 15 | content-brief | pipeline-then-agent | ⚠️ Serper + Firecrawl — **BROKEN** (target keyword lookup fails, always returns empty) | Claude (no tools) | ✅ |
| 16 | content-article | pipeline-then-agent | Serper ×3 searches (stats, news, PAA) — reads `content-brief.targetKeyword` ✅ | Claude (no tools) | ✅ |
| 17 | content-images | pipeline-only | image generation API | none | — |

---

## 7. STEP_CONTEXT_KEYS Slicing (workflow.processor.ts)

Context slicing reduces `<workflow_context>` token cost for late-stage agent-only steps. Missing entries mean the full (80–100K token) context is passed.

| Step | Keys Sliced | Keys In Prompt | Missing From Slice | Risk |
|------|------------|----------------|-------------------|------|
| consolidated-keywords | seed-keywords, method01, method02, method03, phase1-baseline | Same | — | ✅ |
| verdict-strategy | business-profile, site-audit, ai-intelligence, competitor-buckets, competitor-metrics, consolidated-keywords | + search-demand | `search-demand` missing from slice | Low — template interpolation provides it via `{{search-demand}}` from full context; not in `<workflow_context>` XML block |
| topical-map | consolidated-keywords, verdict-strategy, business-profile | Same | — | ✅ |
| content-brief | **not sliced** | topical-map, business-profile | ALL prior 14 steps passed | 🔴 High token cost — add slicing |
| content-article | **not sliced** | content-brief | ALL prior 15 steps passed | 🔴 High token cost — add slicing |

---

## 8. Key Architectural Decisions (Locked)

| ID | Decision |
|----|---------|
| AD-1 | PromptService is single source of truth — no separate fetcher service |
| AD-3 | No AI frameworks (LangChain/AutoGen) — custom agent runtime |
| AD-5 | Credit pre-check before LLM execution |
| AD-10 | Repo is prompt source of truth; Console is deployment target |

Full decision log: `docs/decisions/architecture-decisions-v3.md`

---

## 9. Known Architectural Risks (R13)

| Risk | Severity | Location | Description |
|------|---------|---------|-------------|
| content-brief pipeline broken | 🔴 Critical | `content-brief.pipeline.ts` | Reads `context['verdict-strategy'].contentPlan` which doesn't exist. Target keyword always empty → empty SERP data → hallucinated brief |
| startRun over-charges credits check | 🟡 Medium | `workflow.service.ts:startRun` | `getAllAgents()` includes `business-profile` (30 credits) in total cost, but business-profile never runs as a step. Users see inflated credit requirement. |
| content-brief/article context not sliced | 🟡 Medium | `workflow.processor.ts` | Two late-stage steps pass all 80–100K tokens of prior context to the LLM unnecessarily |
| business-profile stale data | 🟡 Medium | `workflow.service.ts:startRun` | Pre-seeded from project record; no freshness check at run time |
| Production prompt cache no mtime check | 🟠 Low-Medium | `prompt.service.ts` | In `NODE_ENV=production`, local prompt files are cached indefinitely without file modification time validation |
| No rate limiting | 🟡 Medium | All controllers | No rate limiting guards on any REST endpoint. Rapid calls could exhaust credits or saturate Anthropic API |
| Prompt injection via user data | 🟡 Medium | `prompt.service.ts:interpolate` | `project.domain`, `project.industry`, `project.businessProfile` are user-supplied and interpolated directly into LLM prompts |

---

## 10. Audit Checklist Template

- [ ] All `execution_type` values in `.agent.md` files match actual processor routing in `workflow.processor.ts`
- [ ] All pipeline constructors match their `Module.providers[]` registrations
- [ ] `STEP_CONTEXT_KEYS` in `workflow.processor.ts` reflects all steps that need context slicing
- [ ] No new API calls added to steps without updating the API inventory in `audit/performance.md`
- [ ] TypeScript clean: `npx tsc --noEmit` in both `server/` and `frontend/`
- [ ] No new tools registered without updating `audit/tool-audit.md`
- [ ] Database schema migrations applied and `docs/architecture/data-models.md` updated
- [ ] content-brief pipeline target keyword lookup fixed before each content release

---

## 11. Change Log

| Date | Release | Summary |
|------|---------|---------|
| June 4, 2026 | R12 | API deduplication (40+ credits/run saved), DR path fix, context slicing (3 steps), serp-niche-map cap at 20, method03 early gate, 5 prompt corrections |
| June 4, 2026 | R13 | Deep audit: critical content-brief pipeline bug found, startRun credit miscalculation, missing context slicing for steps 15–16, prompt injection surface identified |

---

## 6. Key Architectural Decisions (Locked)

| ID | Decision |
|----|---------|
| AD-1 | PromptService is single source of truth — no separate fetcher service |
| AD-3 | No AI frameworks (LangChain/AutoGen) — custom agent runtime |
| AD-5 | Credit pre-check before LLM execution |
| AD-10 | Repo is prompt source of truth; Console is deployment target |

Full decision log: `docs/decisions/architecture-decisions-v3.md`

---

## 7. Audit Checklist Template

Use this checklist when performing a new architecture audit:

- [ ] All `execution_type` values in `.agent.md` files match actual processor routing in `workflow.processor.ts`
- [ ] All pipeline constructors match their `Module.providers[]` registrations
- [ ] `STEP_CONTEXT_KEYS` in `workflow.processor.ts` reflects actual `depends_on` in each `.agent.md`
- [ ] No new API calls added to steps without updating the API inventory in `audit/performance.md`
- [ ] `docs/features/workflows.md` pipeline table matches current pipeline implementations
- [ ] TypeScript clean: `npx tsc --noEmit` in both `server/` and `frontend/`
- [ ] No new tools registered without updating `audit/tool-audit.md`
- [ ] Database schema migrations applied and `docs/architecture/data-models.md` updated

---

## 8. Change Log

| Date | Release | Summary |
|------|---------|---------|
| June 4, 2026 | R12 | API deduplication (40+ credits/run saved), DR path fix, context slicing (3 steps), serp-niche-map cap at 20, method03 early gate, 5 prompt corrections |
