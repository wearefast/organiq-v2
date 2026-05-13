# Pulse OS v2 — Implementation Plan

> Master checklist. Work row-by-row. Do not skip ahead.
> Discoveries during development go to `docs/technical-debt.md`.

---

## Phase A: Foundation (Infra, Auth, Schema, Shell)

| # | Task | Status | Files |
|---|------|--------|-------|
| A1 | New Docker Compose (pulse_v2 db, redis, api, frontend, python-sidecar) | ✅ | `infra/docker-compose.yml` |
| A2 | Update `.env.example` with all new env vars | ✅ | `.env.example` |
| A3 | Update root `package.json` scripts | ✅ | `package.json` |
| A4 | NestJS bootstrap — new `app.module.ts` with ConfigModule, DatabaseModule, HealthModule | ✅ | `server/src/app.module.ts`, `server/src/main.ts` |
| A5 | Drizzle schema — organizations, org_members, credit_ledger | ✅ | `server/src/db/schema.ts` |
| A6 | Drizzle schema — workspaces, projects | ✅ | `server/src/db/schema.ts` |
| A7 | Drizzle schema — workflow_runs, workflow_steps, step_artifacts, step_approvals, step_tool_calls, workflow_context | ✅ | `server/src/db/schema.ts` |
| A8 | Drizzle schema — keywords, topical_maps, content_pieces, reports | ✅ | `server/src/db/schema.ts` |
| A9 | Generate and run initial migration | ✅ | `server/drizzle/` |
| A10 | Clerk auth module (webhook + guard) | ✅ | `server/src/features/auth/` |
| A11 | Organizations module (CRUD + membership) | ✅ | `server/src/features/organizations/` |
| A12 | Credits module (balance, transactions, pre-check) | ✅ | `server/src/features/credits/` |
| A13 | Next.js bootstrap — new layout, Clerk provider, dark theme globals | ✅ | `frontend/src/app/layout.tsx`, `frontend/src/app/globals.css` |
| A14 | Dashboard shell — top bar, side rail, command palette stub | ✅ | `frontend/src/app/(dashboard)/layout.tsx` |
| A15 | Workspaces CRUD (backend + frontend page) | ✅ | `server/src/features/workspaces/`, `frontend/src/app/(dashboard)/workspaces/` |
| A16 | Projects CRUD (backend + frontend page) | ✅ | `server/src/features/projects/`, `frontend/src/app/(dashboard)/workspaces/[id]/projects/` |

---

## Phase B: Agent Runtime + Workflow Engine

| # | Task | Status | Files |
|---|------|--------|-------|
| B1 | PromptService — file loader, caching, variable interpolation | ✅ | `server/src/shared/prompt/` |
| B2 | Create initial prompt file stubs (discovery, audit, intelligence dirs) | ✅ | `server/src/prompts/` |
| B3 | Integration service — Ahrefs v3 (Site Explorer + Keywords Explorer + Brand Radar) | ✅ | `server/src/features/integrations/ahrefs/` |
| B4 | Integration service — DataForSEO (9 modules) | ✅ | `server/src/features/integrations/dataforseo/` |
| B5 | Integration service — Firecrawl | ✅ | `server/src/features/integrations/firecrawl/` |
| B6 | Integration service — OpenAI (function calling) | ✅ | `server/src/features/integrations/openai/` |
| B7 | Integration service — PageSpeed / CrUX | ✅ | `server/src/features/integrations/pagespeed/` |
| B8 | Integration service — Serper.dev | ✅ | `server/src/features/integrations/serper/` |
| B9 | Integration service — Google Search Console (via python sidecar) | ✅ | `server/src/features/integrations/gsc/` |
| B10 | Tool Registry + Tool Sandbox | ✅ | `server/src/agents/tool.registry.ts`, `server/src/agents/tool.sandbox.ts` |
| B11 | Agent Runtime — execution loop (OpenAI function calling, max iterations, credit metering) | ✅ | `server/src/agents/agent.runtime.ts` |
| B12 | Agent Registry — load .agent.md definitions | ✅ | `server/src/agents/agent.registry.ts` |
| B13 | Output Validator — JSON Schema enforcement | ✅ | `server/src/agents/output.validator.ts` |
| B14 | Workflow Service — create run, step sequencing, dependency resolver | ✅ | `server/src/features/workflows/workflow.service.ts` |
| B15 | BullMQ Step Processor — dequeue step, invoke agent, persist artifact | ✅ | `server/src/features/workflows/workflow.processor.ts` |
| B16 | Workflow Controller — REST endpoints (create, list, get, approve/revise/reject) | ✅ | `server/src/features/workflows/workflow.controller.ts` |
| B17 | WebSocket Gateway — real-time step progress | ✅ | `server/src/features/workflows/workflow.gateway.ts` |

---

## Phase C: Workflow UI

| # | Task | Status | Files |
|---|------|--------|-------|
| C1 | Workflow shell layout (step rail + artifact panel) | ✅ | `frontend/src/features/workflow/components/workflow-shell.tsx` |
| C2 | Step Rail component (17 steps, phase grouping, status indicators) | ✅ | `frontend/src/features/workflow/components/step-rail.tsx` |
| C3 | Artifact Panel (content area + approval bar) | ✅ | `frontend/src/features/workflow/components/artifact-panel.tsx` |
| C4 | WebSocket hook — real-time step updates | ✅ | `frontend/src/features/workflow/hooks/use-workflow-ws.ts` |
| C5 | Artifact renderer — Business Profile (Step 1) | ✅ | `frontend/src/features/workflow/renderers/business-profile.tsx` |
| C6 | Artifact renderer — Seed Keywords (Step 2) | ✅ | `frontend/src/features/workflow/renderers/seed-keywords.tsx` |
| C7 | Agent Reasoning panel (expandable) | ✅ | `frontend/src/features/workflow/components/reasoning-panel.tsx` |
| C8 | Tool Call Audit Trail (expandable) | ✅ | `frontend/src/features/workflow/components/tool-call-trail.tsx` |
| C9 | Progress bar + step timing | ✅ | `frontend/src/features/workflow/components/progress-bar.tsx` |
| C10 | Workflow runs list page | ✅ | `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/workflows/page.tsx` |
| C11 | "Start Run" flow (button → create run → redirect to shell) | ✅ | `frontend/src/features/workflow/components/start-run.tsx` |
| C12 | Frontend workflow service (API calls) | ✅ | `frontend/src/features/workflow/services/workflow.service.ts` |

---

## Phase D: Phase 1 Agents (Intelligence & Audit — Steps 1-8)

| # | Task | Status | Files |
|---|------|--------|-------|
| D1 | Agent definition — `business-profile.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/discovery/` |
| D2 | Agent definition — `seed-keywords.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/discovery/` |
| D3 | Agent definition — `site-audit.agent.md` + prompt files + rubrics | ✅ | `server/src/agents/definitions/`, `server/src/prompts/audit/` |
| D4 | Agent definition — `ai-intelligence.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/intelligence/` |
| D5 | Agent definition — `serp-niche-map.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/discovery/` |
| D6 | Agent definition — `competitor-buckets.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/competitors/` |
| D7 | Agent definition — `competitor-metrics.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/competitors/` |
| D8 | Agent definition — `search-demand.agent.md` + prompt files | ✅ | `server/src/agents/definitions/`, `server/src/prompts/intelligence/` |
| D9 | Artifact renderers — Site Audit, AI Intelligence, Search Demand | ✅ | `frontend/src/features/workflow/renderers/` |
| D10 | Python sidecar — `/analyze/citability`, `/analyze/pagespeed`, `/analyze/gsc-performance`, `/analyze/brand-mentions` | ✅ | `python-sidecar/` |
| D11 | End-to-end test — run Steps 1-8 for a test domain | ✅ | code trace verified |

---

## Phase E: Phase 2 Agents + Keywords (Steps 9-13)

| # | Task | Status | Files |
|---|------|--------|-------|
| E1 | Agent definition — `phase1-baseline.agent.md` | ✅ | `server/src/agents/definitions/` |
| E2 | Agent definition — `method01-competitor-pages.agent.md` | ✅ | `server/src/agents/definitions/` |
| E3 | Agent definition — `method02-seed-expansion.agent.md` | ✅ | `server/src/agents/definitions/` |
| E4 | Agent definition — `method03-content-gap-import.agent.md` (manual import UI) | ✅ | `server/src/agents/definitions/` |
| E5 | Agent definition — `consolidated-keywords.agent.md` | ✅ | `server/src/agents/definitions/` |
| E6 | Artifact renderers — Phase 1 Baseline, Methods 01-03, Consolidation | ✅ | `frontend/src/features/workflow/renderers/` |
| E7 | Python sidecar — `/analyze/keywords`, `/analyze/opportunity`, `/analyze/competitor-gaps` | ✅ | `python-sidecar/` |
| E8 | Keywords module (backend — ledger, bulk import, status updates) | ✅ | `server/src/features/keywords/` |
| E9 | Keyword Ledger page (frontend) | ✅ | `frontend/src/app/(dashboard)/.../keywords/` |

---

## Phase F: Phase 3 Agents + Strategy (Steps 14-15)

| # | Task | Status | Files |
|---|------|--------|-------|
| F1 | 5 industry strategy templates (SaaS, local, ecommerce, publisher, agency) | ✅ | `server/src/prompts/strategy/` |
| F2 | Agent definition — `verdict-strategy.agent.md` + prompt files | ✅ | `server/src/agents/definitions/` |
| F3 | Agent definition — `topical-map.agent.md` + prompt files | ✅ | `server/src/agents/definitions/` |
| F4 | Artifact renderers — Verdict & Strategy, Topical Map | ✅ | `frontend/src/features/workflow/renderers/` |
| F5 | Topical Maps module (backend — pillars, clusters, calendar) | ✅ | `server/src/features/topical-maps/` |
| F6 | Visual Topical Map page (frontend — tree/graph view) | ✅ | `frontend/src/app/(dashboard)/.../topical-map/` |
| F7 | End-to-end test — run Steps 14-15 with Phase 1+2 data | ✅ | code trace verified |

---

## Phase G: Phase 4 Agents + Content (Steps 16-17)

| # | Task | Status | Files |
|---|------|--------|-------|
| G1 | Prompt files — content brief (SERP analysis, schema markup, outline template) | ✅ | `server/src/prompts/content/` |
| G2 | Prompt files — content article (brand voice, structure, optimization rules) | ✅ | `server/src/prompts/articles/` |
| G3 | Scoring rubrics — readability, SEO quality, AI citability, opportunity, content length | ✅ | `server/src/prompts/scoring/` |
| G4 | Agent definition — `content-brief.agent.md` | ✅ | `server/src/agents/definitions/` |
| G5 | Agent definition — `content-article.agent.md` | ✅ | `server/src/agents/definitions/` |
| G6 | Python sidecar — `/analyze/readability`, `/analyze/content-score` | ✅ | `python-sidecar/` |
| G7 | Artifact renderers — Content Brief, Content Article + Score Dashboard | ✅ | `frontend/src/features/workflow/renderers/` |
| G8 | Content module (backend — CRUD, status, batch ops) | ✅ | `server/src/features/content/` |
| G9 | Content pages (frontend — list, editor, score dashboard) | ✅ | `frontend/src/app/(dashboard)/.../content/` |
| G10 | Batch content operations (generate N briefs/articles from topical map) | ✅ | `server/src/features/content/` |

---

## Phase H: Reports + Polish

| # | Task | Status | Files |
|---|------|--------|-------|
| H1 | Report templates (4: Full Strategy, AI Visibility, Keyword Research, Content Plan) | ✅ | `server/src/prompts/reports/` |
| H2 | Python sidecar — `/reports/pdf` (ReportLab generation) | ✅ | `python-sidecar/routers/reports.py`, `python-sidecar/requirements.txt` |
| H3 | Reports module (backend — generate, list, download) | ✅ | `server/src/features/reports/` |
| H4 | Reports page (frontend — generate, list, download) | ✅ | `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/reports/page.tsx` |
| H5 | Settings page (org, workspace, API keys, credits) | ✅ | `frontend/src/app/(dashboard)/settings/page.tsx` |
| H6 | Command Palette (⌘K) | ✅ | `frontend/src/shared/components/command-palette.tsx` |
| H7 | Keyboard shortcuts (J/K navigation, A/R/E approval) | ✅ | `frontend/src/shared/hooks/use-keyboard-shortcuts.ts` |
| H8 | Dark/Light mode toggle | ✅ | `frontend/src/shared/hooks/use-theme.tsx`, `frontend/src/app/globals.css` |

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| A | 16 | Foundation — infra, auth, schema, shell |
| B | 17 | Agent runtime + workflow engine |
| C | 12 | Workflow UI |
| D | 11 | Phase 1 agents (intelligence & audit) |
| E | 9 | Phase 2 agents + keywords |
| F | 7 | Phase 3 agents + strategy |
| G | 10 | Phase 4 agents + content |
| H | 8 | Reports + polish |
| **Total** | **90** | |
