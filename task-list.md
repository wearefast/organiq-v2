# Pulse OS v3 — Task List & Progress Tracker

> **Branch:** `OS-version1`  
> **Started:** May 18, 2026  
> **Method:** Vertical slices. Each release ships one customer-facing capability from backend → frontend → QA. Nothing moves forward until QA gate passes.  
> **Mode:** Development (existing workflow runs expendable — no migration needed)

---

## Legend

- [ ] Not started
- [x] Completed
- 🔄 In progress
- ⛔ Blocked

---

## Architecture Decisions (Locked)

| # | Decision | Rationale |
|---|----------|-----------|
| AD-1 | Extend existing `PromptService` with Console fetcher method. No separate service. | Single source of truth. Existing cache + fallback logic reused. |
| AD-2 | GSC moves fully into NestJS. Retire Python sidecar GSC proxy. | Eliminates split-brain auth. NestJS handles OAuth natively. |
| AD-3 | MCP is cut entirely. Tools stay in `ToolRegistry` as direct service calls. | Avoids double-migration churn. Current tool system works. |
| AD-4 | Provider adapter pattern in `AgentRuntime`. `LlmProvider` interface with `OpenAiProvider` + `AnthropicProvider`. | Keeps OpenAI path working during migration. No big-bang swap. |
| AD-5 | Feature flags via env vars for provider routing. `AGENT_PROVIDER_OVERRIDE`. | Safe rollback: flip env var. |
| AD-6 | Reuse existing Docker containers (postgres:5433, redis:6379). Fresh schema via `db:push`. | Dev mode = no data to preserve. |
| AD-7 | Thinking traces + execution provenance in `step_artifacts.metadata` JSONB. | Collocated with output. Single query for full step result. |
| AD-8 | Credit model: variable cost per agent type. Retries free. Only verified success debits. | Consistent with existing atomic debit pattern. |
| AD-9 | Data retention: traffic 90d, thinking 30d, visibility 1y. Weekly purge cron. | Prevents unbounded growth. |
| AD-10 | Prompt governance: Repo = source of truth. Console = deployment target. CI syncs. | Version control. Diffable. Rollback via git revert. |
| AD-11 | Tier 4 Orchestrator deferred indefinitely. On-demand agents suffice. | Simpler. No speculative architecture. |
| AD-12 | Python sidecar: kill across R1 (analysis), R3 (GSC), R10 (PDF + container). | Eliminates deployment unit, Python runtime, CORS hop, port. |
| AD-13 | Synthetic test data only. No real client data in repo. | Privacy-safe, reproducible, controllable. |

---

## Tier Classification (Locked)

| Step | Tier | Rationale |
|------|------|-----------|
| competitor-metrics | Tier 1 (pipeline) | Deterministic API batch calls. No LLM reasoning needed. |
| search-demand | Tier 1 (pipeline) | Deterministic batch volume + difficulty lookups. |
| method01-competitor-pages | Tier 1 (pipeline) | Deterministic batch Ahrefs data. |
| method02-seed-expansion | Tier 1 (pipeline) | Deterministic batch expansion. |
| method03-content-gap | Tier 1 (pipeline) | Deterministic gap analysis. |
| consolidated-keywords | Tier 2 (thinking, no tools) | Consolidation from context. Spot-check tools dropped. |
| verdict-strategy | Tier 2 (thinking, no tools) | Strategy synthesis from context. serper_search was marginal. |
| topical-map | Tier 2 (thinking, no tools) | Architecture from context. SERP checks marginal. |
| phase1-baseline | Tier 3 (thinking + tools) | Uses ahrefs_organic_keywords as PRIMARY data source. |
| seed-keywords | Tier 3 (thinking + tools) | Heavy tool usage for discovery. |
| content-brief | Tier 3 (thinking + tools) | Tool-assisted brief generation. |
| content-article | Tier 3 (thinking + tools) | Tool-assisted content generation. |
| site-audit | Tier 3 (thinking + tools) | Heavy tool usage for audit data. |

---

## QA Strategy

| Layer | Tool | Gate Criteria |
|-------|------|---------------|
| Unit | Vitest | All pass, coverage ≥ 80% on new code |
| Integration | Vitest + Supertest | Real DB, real Redis, mocked external APIs |
| E2E | Playwright | Golden-path flows on seeded data |
| Type safety | `tsc --noEmit` | Zero errors both packages |
| Lint | ESLint | Zero errors |
| Regression | Full suite re-run | No regressions from prior releases |

**Auth in tests:** Seeded org + member rows. Mock JWT matching seeded clerkUserId. ClerkGuard verifies against local JWKS in test mode.

---

## RELEASE 0: Foundation (Test Harness + SDK + Observability)

### 0.1 Test Infrastructure

| # | Task | Status |
|---|------|--------|
| 0.1.1 | Install Vitest + `@vitest/coverage-v8` + Supertest + `@types/supertest` in server | [x] |
| 0.1.2 | Create `server/vitest.config.ts` with path aliases matching tsconfig | [x] |
| 0.1.3 | Add test scripts to `server/package.json`: `test`, `test:watch`, `test:coverage` | [x] |
| 0.1.4 | Create `server/src/test/setup.ts` (DB connection, truncate, transaction wrapper) | [x] |
| 0.1.5 | Create deterministic fixtures: org, member, workspace, project, workflow run | [x] |
| 0.1.6 | Create mock JWT helper (local RSA key pair, JWKS endpoint, matches seeded clerkUserId) | [x] |
| 0.1.7 | Create mock providers (OpenAI, Ahrefs, DataForSEO — deterministic responses) | [x] |
| 0.1.8 | Write 1 smoke test: health controller | [x] |
| 0.1.9 | Install Playwright in frontend | [x] |
| 0.1.10 | Create `frontend/playwright.config.ts` (baseURL 3001, webServer for backend) | [x] |
| 0.1.11 | Create `frontend/e2e/helpers/auth.setup.ts` (storageState with mock JWT) | [x] |
| 0.1.12 | Write 1 smoke E2E: login + dashboard accessible | [x] |

### 0.2 Structured Logging + Observability

| # | Task | Status |
|---|------|--------|
| 0.2.1 | Install `pino` + `nestjs-pino` in server | [x] |
| 0.2.2 | Configure JSON logging with correlationId per request | [x] |
| 0.2.3 | Add BullMQ event listeners (log job start/complete/fail with stepKey) | [x] |
| 0.2.4 | Create `dlq_failed_steps` table (id, workflowStepId, error, failedAt, attemptCount, jobData, resolvedAt) | [x] |
| 0.2.5 | Capture failed job on 3rd BullMQ attempt into DLQ table | [x] |
| 0.2.6 | Add `GET /admin/dlq`, `POST /admin/dlq/:id/replay`, `POST /admin/dlq/:id/dismiss` | [x] |

### 0.3 Anthropic SDK + Provider Adapter

| # | Task | Status |
|---|------|--------|
| 0.3.1 | `npm install @anthropic-ai/sdk` in server | [x] |
| 0.3.2 | Add env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_DEFAULT_MODEL` | [x] |
| 0.3.3 | Create `AnthropicModule` (global) + `AnthropicService` (retry, rate-limit) | [x] |
| 0.3.4 | Create `LlmProvider` interface: `execute()`, `executeTier2()`, `executeTier3()` | [x] |
| 0.3.5 | Create `OpenAiProvider` (wraps existing `OpenAiService.chatCompletion`) | [x] |
| 0.3.6 | Create `AnthropicProvider` (wraps `AnthropicService`) | [x] |
| 0.3.7 | Refactor `AgentRuntime` to inject `LlmProvider[]` and route by config.provider | [x] |
| 0.3.8 | Add `AGENT_PROVIDER_OVERRIDE` env var logic | [x] |
| 0.3.9 | Unit tests: both providers (mocked API calls, retries, errors) | [x] |

### 0.4 Agent Definition Schema Extension

| # | Task | Status |
|---|------|--------|
| 0.4.1 | Extend `AgentDefinition` interface: `provider?`, `tier?`, `thinkingBudget?` | [x] |
| 0.4.2 | Update `PromptService.parseAgentDefinition()` — backwards-compatible defaults (provider=openai, tier=tier3) | [x] |
| 0.4.3 | Update `AgentRegistry` to expose new fields | [x] |
| 0.4.4 | Unit tests: old-format .agent.md still works, new-format parses correctly | [x] |

### 0.5 Documentation

| # | Task | Status |
|---|------|--------|
| 0.5.1 | Update `docs/architecture/backend-architecture.md` (provider adapter, observability) | [x] |
| 0.5.2 | Update `docs/features/integrations.md` (add Anthropic) | [x] |
| 0.5.3 | Update `docs/features/workflows.md` (tier/provider fields) | [x] |
| 0.5.4 | Create `docs/decisions/architecture-decisions-v3.md` (AD-1 through AD-13) | [x] |

### ✅ QA Gate: Release 0

| # | Verification | Status |
|---|-------------|--------|
| QA-0.1 | `npm test` passes in server (health smoke test) | [x] |
| QA-0.2 | `npm run test:e2e` passes in frontend (login smoke E2E) | [ ] |
| QA-0.3 | `AGENT_PROVIDER_OVERRIDE=openai` → existing workflow succeeds (no regression) | [ ] |
| QA-0.4 | `AGENT_PROVIDER_OVERRIDE=anthropic` → trivial agent responds | [ ] |
| QA-0.5 | Structured logs verified: JSON format with correlationId | [ ] |
| QA-0.6 | DLQ captures forced failure and replay works | [ ] |
| QA-0.7 | `tsc --noEmit` passes both packages | [x] |

---

## RELEASE 1: Claude Runtime Migration

### 1.1 Tier 2 Execution Path

| # | Task | Status |
|---|------|--------|
| 1.1.1 | Implement `executeTier2()` in `AnthropicProvider` — single Messages call with thinking (no tool loop) | [x] |
| 1.1.2 | Handle thinking blocks in response, extract thinking trace | [x] |
| 1.1.3 | Add `metadata` JSONB column to `step_artifacts` (Drizzle migration) | [x] |
| 1.1.4 | Store provenance in metadata: `{ thinkingTrace, provider, model, promptSource, promptVersion, tokensUsed, shadowVerdictIfAny }` | [x] |
| 1.1.5 | Update `WorkflowProcessor` to persist metadata alongside artifact | [x] |

### 1.2 Verification Service

| # | Task | Status |
|---|------|--------|
| 1.2.1 | Create `server/src/shared/verification/verification.module.ts` (global) | [x] |
| 1.2.2 | Create `VerificationService` + `VerificationRule` interface | [x] |
| 1.2.3 | Implement `consolidated-keywords` rule (count match, no dupes, all required fields) | [x] |
| 1.2.4 | Integrate into `WorkflowProcessor`: verify after execution, before debit | [x] |
| 1.2.5 | On verification fail → retry with feedback (max 2 retries, free per AD-8) | [x] |
| 1.2.6 | Unit tests: pass/fail/retry scenarios | [x] |

### 1.3 Migrate consolidated-keywords to Claude

| # | Task | Status |
|---|------|--------|
| 1.3.1 | Update `consolidated-keywords.agent.md` frontmatter: `provider: anthropic, tier: tier2, thinking_budget: 32000` | [x] |
| 1.3.2 | Remove `tools:` section from frontmatter (data available in workflow_context) | [x] |
| 1.3.3 | WorkflowProcessor routes `tier: tier2` → `provider.executeTier2()` | [x] |
| 1.3.4 | Run with real data, compare quality vs. OpenAI output | [ ] |

### 1.4 Shadow Mode

| # | Task | Status |
|---|------|--------|
| 1.4.1 | Create `ShadowService` — runs both providers, logs diff, returns primary result | [x] |
| 1.4.2 | Add `SHADOW_MODE_STEPS` env var (comma-separated step keys) | [x] |
| 1.4.3 | Shadow `verdict-strategy`, `topical-map`, `phase1-baseline` | [x] |
| 1.4.4 | Review shadow logs → decide migration confidence per step | [ ] |

### 1.5 Migrate Remaining Tier 2

| # | Task | Status |
|---|------|--------|
| 1.5.1 | Add verification rules for `verdict-strategy`, `topical-map` | [x] |
| 1.5.2 | Remove tools from `verdict-strategy.agent.md` (serper_search spot-check dropped) | [x] |
| 1.5.3 | Remove tools from `topical-map.agent.md` (serper_search + dataforseo_serp dropped) | [x] |
| 1.5.4 | Update frontmatter: `provider: anthropic, tier: tier2, thinking_budget: 32000` | [x] |
| 1.5.5 | Full Phase 2-3 workflow integration test | [ ] |

### 1.6 Tier 1 Pipelines (Replace Agents with Code)

| # | Task | Status |
|---|------|--------|
| 1.6.1 | Create `Pipeline` interface: `execute(context): Promise<output>` | [x] |
| 1.6.2 | Create `server/src/features/workflows/pipelines/` directory | [x] |
| 1.6.3 | Implement `competitor-metrics.pipeline.ts` — direct Ahrefs batch calls | [x] |
| 1.6.4 | Implement `search-demand.pipeline.ts` — batch volume + difficulty lookups | [x] |
| 1.6.5 | Implement `method01-competitor-pages.pipeline.ts` | [x] |
| 1.6.6 | Implement `method02-seed-expansion.pipeline.ts` | [x] |
| 1.6.7 | Implement `method03-content-gap.pipeline.ts` | [x] |
| 1.6.8 | Update `WorkflowProcessor` to route `tier: tier1` → pipeline service | [x] |
| 1.6.9 | Update agent definitions: `tier: tier1` for all 5 steps | [x] |
| 1.6.10 | Unit tests per pipeline (deterministic inputs → expected outputs) | [x] |

### 1.7 Sidecar Analysis → NestJS Utils (AD-12 Phase 1)

| # | Task | Status |
|---|------|--------|
| 1.7.1 | Create `server/src/shared/analysis/` directory | [x] |
| 1.7.2 | Port `citability` → `citability.util.ts` (use cheerio, already installed) | [x] |
| 1.7.3 | Port `pagespeed` → `pagespeed-parser.util.ts` (pure JSON transform) | [x] |
| 1.7.4 | Port keyword scoring → `keyword-scoring.util.ts` (opportunity formula) | [x] |
| 1.7.5 | Port opportunity filter → `opportunity-filter.util.ts` (threshold filter) | [x] |
| 1.7.6 | Port competitor-gaps → `competitor-gaps.util.ts` (set difference) | [x] |
| 1.7.7 | Port brand-mentions → `brand-mentions.util.ts` (regex + count) | [x] |
| 1.7.8 | Update all callers to use local utils instead of sidecar HTTP calls | [x] |
| 1.7.9 | Unit test each utility (same inputs → same outputs as Python versions) | [x] |

### 1.8 Tier 3 Execution Path

| # | Task | Status |
|---|------|--------|
| 1.8.1 | Implement `executeTier3()` in `AnthropicProvider` — tool loop with thinking, 50K tool results | [x] |
| 1.8.2 | Remove `MAX_TOOL_RESULT_CHARS` truncation for anthropic provider | [x] |
| 1.8.3 | Map `ToolRegistry` defs to Claude tool format | [x] |
| 1.8.4 | Handle `tool_use` blocks → `ToolSandbox` → `tool_result` blocks | [x] |
| 1.8.5 | Migrate `phase1-baseline` to Claude Tier 3 (keeps tools, adds thinking) | [x] |
| 1.8.6 | Migrate `seed-keywords` to Claude Tier 3 | [x] |
| 1.8.7 | Migrate `content-brief` to Claude Tier 3 | [x] |
| 1.8.8 | Migrate `content-article` to Claude Tier 3 | [x] |
| 1.8.9 | Migrate `site-audit` to Claude Tier 3 | [x] |
| 1.8.10 | Integration test: tool loop completes within max_iterations | [ ] |

### 1.9 Documentation

| # | Task | Status |
|---|------|--------|
| 1.9.1 | Update `docs/features/workflows.md` (tier routing, verification, pipelines) | [x] |
| 1.9.2 | Update `docs/features/credits.md` (retry-free model, verification) | [x] |

### ✅ QA Gate: Release 1

| # | Verification | Status |
|---|-------------|--------|
| QA-1.1 | All provider/verification/pipeline unit tests pass | [x] |
| QA-1.2 | `consolidated-keywords` verified correctly via Claude Tier 2 | [ ] |
| QA-1.3 | Full 18-step workflow completes with correct tier/provider per step | [ ] |
| QA-1.4 | Rollback test: `AGENT_PROVIDER_OVERRIDE=openai` still works end-to-end | [ ] |
| QA-1.5 | DLQ captures failures with full context | [ ] |
| QA-1.6 | All 6 ported analysis utils produce same outputs as Python sidecar (parity tests) | [x] |
| QA-1.7 | Sidecar analysis routes no longer called (grep PYTHON_SIDECAR_URL in analysis = 0) | [x] |
| QA-1.8 | `tsc --noEmit` passes both packages | [x] |

---

## RELEASE 2: Prompt Governance + Console Sync

### 2.1 Console Integration

| # | Task | Status |
|---|------|--------|
| 2.1.1 | Extend `PromptService` with `fetchFromConsole(promptId, version?)` method | [x] |
| 2.1.2 | 5-min TTL cache, fallback to local file on Console failure | [x] |
| 2.1.3 | Add `prompt_id` field to `AgentDefinition` (optional) | [x] |
| 2.1.4 | Add `PROMPT_SOURCE` env var: `local | console | hybrid` | [x] |

### 2.2 Sync CI

| # | Task | Status |
|---|------|--------|
| 2.2.1 | Create `scripts/sync-prompts-to-console.ts` (reads .agent.md, upserts to Console) | [x] |
| 2.2.2 | Version by git commit hash | [x] |
| 2.2.3 | Add npm scripts: `prompts:sync`, `prompts:diff` | [x] |

### 2.3 Evaluation Harness

| # | Task | Status |
|---|------|--------|
| 2.3.1 | Create prompt eval framework: load prompt + test input → Claude → check rubric | [x] |
| 2.3.2 | Write 3 eval cases each for consolidated-keywords, verdict-strategy, topical-map | [x] |
| 2.3.3 | Add npm script: `prompts:eval` — pass/fail gate before Console sync | [x] |

### ✅ QA Gate: Release 2

| # | Verification | Status |
|---|-------------|--------|
| QA-2.1 | Console fetch returns correct prompt | [ ] |
| QA-2.2 | Fallback to local works when Console offline | [ ] |
| QA-2.3 | `prompts:sync` uploads without error | [ ] |
| QA-2.4 | `prompts:eval` passes all 9 cases | [x] |
| QA-2.5 | No regression in any `PROMPT_SOURCE` mode | [ ] |

---

## RELEASE 3: SEO Analytics — GSC Vertical

### 3.1 Backend

| # | Task | Status |
|---|------|--------|
| 3.1.1 | Create `gsc.module.ts`, `gsc.service.ts` (OAuth, token refresh, pullSearchAnalytics) | [x] |
| 3.1.2 | Create `gsc.controller.ts` (connect, callback, keywords, summary) | [x] |
| 3.1.3 | Encrypted token storage (AES-256-GCM) | [x] |
| 3.1.4 | Schema: `gscConnections` + `gscKeywordData` tables + migration | [x] |
| 3.1.5 | BullMQ: `gsc:sync` daily, `gsc:historical` on first connect | [x] |
| 3.1.6 | Port `gsc-performance` analysis (aggregation logic) into `gsc.service` directly | [x] |
| 3.1.7 | Remove sidecar GSC routes — NestJS now owns all GSC | [x] |

### 3.2 Frontend

| # | Task | Status |
|---|------|--------|
| 3.2.1 | Create analytics route group + keyword-dashboard component | [x] |
| 3.2.2 | GSC connect card (settings) | [x] |
| 3.2.3 | Recharts charts (position tiers, trend) | [x] |
| 3.2.4 | API hooks: `useGscKeywords()`, `useGscPages()`, `useGscSummary()` | [x] |

### 3.3 Documentation

| # | Task | Status |
|---|------|--------|
| 3.3.1 | Update `docs/features/integrations.md`, `docs/architecture/api-reference.md`, `docs/architecture/data-models.md` | [x] |

### ✅ QA Gate: Release 3

| # | Verification | Status |
|---|-------------|--------|
| QA-3.1 | Token encryption roundtrip | [x] |
| QA-3.2 | OAuth flow completes (mocked Google) | [ ] |
| QA-3.3 | Sync processor stores correct data | [ ] |
| QA-3.4 | API pagination + auth enforcement | [ ] |
| QA-3.5 | E2E: connect + dashboard renders | [ ] |
| QA-3.6 | GSC analysis parity test (same outputs as old sidecar) | [ ] |
| QA-3.7 | Sidecar only serves PDF at this point | [ ] |

---

## RELEASE 4: Decay Detection + Notifications

| # | Task | Status |
|---|------|--------|
| 4.1 | Create `keywordDecayAlerts` table + decay-detection service | [x] |
| 4.2 | Create `notifications` table + service + controller | [x] |
| 4.3 | Decay → notification for project members | [x] |
| 4.4 | Frontend: decay alerts list + notification bell | [x] |
| 4.5 | QA: threshold edge cases, notification CRUD, E2E | [x] |

---

## RELEASE 5: AI Search — LLM Traffic

| # | Task | Status |
|---|------|--------|
| 5.1 | Create `llmTrafficSessions` (90-day TTL) + `llmTrafficStats` tables | [x] |
| 5.2 | Traffic service + controller (rate-limited ingest) | [x] |
| 5.3 | Create `pulse-tracker.js` (<2kb, 12 engines, no PII) | [x] |
| 5.4 | Aggregation cron + TTL purge job | [x] |
| 5.5 | Frontend: traffic overview dashboard | [x] |
| 5.6 | QA: ingest validation, rate limit, script size, privacy | [x] |

---

## RELEASE 6: AI Search — Prompt Visibility

| # | Task | Status |
|---|------|--------|
| 6.1 | Create `trackedPrompts` + `promptVisibilityResults` (1-year) tables | [x] |
| 6.2 | Engine query service (5 engines, 3× majority vote) | [x] |
| 6.3 | Visibility parser (mention detection, position, citations) | [x] |
| 6.4 | Prompt check processor (BullMQ, configurable frequency) | [x] |
| 6.5 | Frontend: prompt tracker + brand visibility score | [x] |
| 6.6 | QA: parser tests, mock engine tests, E2E | [x] |

---

## RELEASE 7: Technical SEO — LLM Audit

| # | Task | Status |
|---|------|--------|
| 7.1 | Create `llmAuditResults` table | [x] |
| 7.2 | 6 deterministic checks (bots, structure, trust, chunking, schema, sitemap) | [x] |
| 7.3 | Audit service (weighted score + Opus recommendations) | [x] |
| 7.4 | Frontend: audit report (gauge, bot matrix, recommendations) | [x] |
| 7.5 | QA: all 6 checks tested, E2E audit flow | [x] |

---

## RELEASE 8: On-Demand Agents — First Agent

| # | Task | Status |
|---|------|--------|
| 8.1 | Agent framework (router, executor, context builders) | [ ] |
| 8.2 | Content Refresh context builder + prompt | [ ] |
| 8.3 | `agentRuns` table, credit logic (variable cost, no charge on failure) | [ ] |
| 8.4 | Frontend: agent chat UI | [ ] |
| 8.5 | QA: router classification, context shape, E2E agent run | [ ] |

---

## RELEASE 9: All Agents + Scheduling

| # | Task | Status |
|---|------|--------|
| 9.1 | 6 additional context builders + prompts | [ ] |
| 9.2 | Scheduled workflows (table, scheduler, BullMQ) | [ ] |
| 9.3 | Delivery: Slack + Email | [ ] |
| 9.4 | Frontend: workflow builder + run history | [ ] |
| 9.5 | QA: all 7 types, scheduling fires correctly, credit enforcement | [ ] |

---

## RELEASE 10: Sidecar Kill + UI Restructure + Retention

### 10.1 PDF Generation Port (AD-12 Final Phase)

| # | Task | Status |
|---|------|--------|
| 10.1.1 | Create `server/src/features/reports/pdf/pdf-generator.service.ts` | [x] |
| 10.1.2 | Port ReportLab PDF logic using `pdfmake` (or `@react-pdf/renderer` server-side) | [x] |
| 10.1.3 | Match existing PDF output: title, sections, tables, branding, page numbers | [x] |
| 10.1.4 | Update reports controller/service to use local PDF generator | [x] |
| 10.1.5 | Parity test: new PDF has same structure/content as old sidecar PDF | [x] |
| 10.1.6 | Remove `python-sidecar/` directory from repo | [x] |
| 10.1.7 | Remove sidecar from `infra/docker-compose.yml` | [x] |
| 10.1.8 | Remove `PYTHON_SIDECAR_URL` env var from all configs | [x] |
| 10.1.9 | Update `docs/architecture/system-design.md` — remove sidecar from topology | [x] |
| 10.1.10 | Verify: `npm run build` + full test suite passes without sidecar running | [x] |

### 10.2 Navigation Restructure

| # | Task | Status |
|---|------|--------|
| 10.2.1 | Update `side-nav.tsx`: Overview, AI Search, Analytics, Technical, Agents, Content, Research, Settings | [x] |
| 10.2.2 | Create overview health dashboard (AI Visibility + Traffic + Technical + Alerts) | [x] |
| 10.2.3 | Create Settings routes (integrations, tracking script setup) | [x] |
| 10.2.4 | Move existing workflow routes under "Research" | [x] |
| 10.2.5 | Move existing content routes under "Content" | [x] |
| 10.2.6 | Update `breadcrumb.tsx` LABEL_MAP for new route segments | [x] |

### 10.3 Data Retention

| # | Task | Status |
|---|------|--------|
| 10.3.1 | Create `retention.service.ts` — purge per AD-9 (traffic 90d, thinking 30d) | [x] |
| 10.3.2 | Schedule weekly purge cron | [x] |
| 10.3.3 | Log purge stats | [x] |

### ✅ QA Gate: Release 10

| # | Verification | Status |
|---|-------------|--------|
| QA-10.1 | PDF parity test passes | [x] |
| QA-10.2 | Full test suite passes WITHOUT sidecar running | [x] |
| QA-10.3 | E2E: all nav items render, route correctly | [x] |
| QA-10.4 | E2E: overview dashboard renders 4 widgets | [x] |
| QA-10.5 | Retention cron purges old data, keeps recent | [x] |
| QA-10.6 | No broken links in navigation | [x] |
| QA-10.7 | Regression: all prior QA gates pass | [x] |

---

## RELEASE 11: Stripe Credits (Future)

| # | Task | Status |
|---|------|--------|
| 11.1 | Stripe integration (checkout, subscribe, webhooks) | [x] |
| 11.2 | `subscriptions` + `purchases` tables | [x] |
| 11.3 | Plan limits enforcement | [x] |
| 11.4 | Frontend: billing page | [x] |
| 11.5 | QA: webhook validation, plan gates, security | [x] |

---

## SEQUENCING

```
R0 (Foundation) ← MUST complete first
  ↓
R1 (Runtime + Sidecar Analysis Kill) ← Blocks all new modules. After R1: sidecar only serves GSC + PDF.
  ↓
R2 (Prompts) ← Can overlap with R3
  ↓
R3 (GSC + Sidecar GSC Kill) ──────┐   After R3: sidecar only serves PDF.
R5 (Traffic) ───────────────────────┼── Independent after R1
R7 (Audit) ─────────────────────────┘
  ↓
R4 (Decay) ← needs R3
R6 (Visibility) ← needs R5
  ↓
R8 (First Agent) ← needs R3, R5, R7
  ↓
R9 (All Agents) ← extends R8
  ↓
R10 (UI + Sidecar PDF Kill + Container Removal) ← After R10: sidecar GONE.
  ↓
R11 (Stripe) ← independent, whenever pricing ready
```

---

## ROLLBACK

| Scenario | Action |
|----------|--------|
| Claude worse than OpenAI | `AGENT_PROVIDER_OVERRIDE=openai` |
| Console prompts broken | `PROMPT_SOURCE=local` |
| New module unstable | Feature flag hides nav item + guard returns 404 |
| Schema migration breaks | `db:push` with reverted schema (dev mode, no data loss) |
| Job failures | DLQ capture + replay via `/admin/dlq` |

---

## KEY FILES TO MODIFY

| File | Change |
|------|--------|
| `server/src/agents/agent.runtime.ts` | Add provider routing, remove hardcoded OpenAI |
| `server/src/agents/agent.registry.ts` | Expose provider, tier, thinkingBudget |
| `server/src/shared/prompt/prompt.service.ts` | Add Console fetcher, parse new frontmatter fields |
| `server/src/features/workflows/workflow.processor.ts` | Tier routing + verification + pipeline dispatch |
| `server/src/db/schema.ts` | New tables per release, metadata column |
| `frontend/src/shared/components/side-nav.tsx` | Progressive nav additions |
| `frontend/src/shared/components/breadcrumb.tsx` | Updated LABEL_MAP |
