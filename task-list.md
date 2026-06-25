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

## RELEASE 12: API & LLM Cost Optimisation

> **Branch:** `OS-version1-enhancements`
> **Audit source:** Full 30-file pipeline/agent/prompt audit, June 2026
> **Background:** Four "dedup" optimisations shipped in a prior session incorrectly assumed that pipeline `rawData` is accessible in downstream `workflowContext`. It is not. `workflow.processor.ts` stores only the Claude agent's structured output — not the pipeline's intermediate `rawData` — via `setContext()`. This means every optimisation that checked `context['step-key'].rawData?.…` is a no-op at best, a silent regression at worst. In addition, an unrelated design bug was discovered in `method03` where a required prompt variable is never populated.

---

### P0 — Silent regressions producing wrong output data

#### 12.1 Fix competitor-metrics: target domain DR always returns 0

| # | Task | Status |
|---|------|--------|
| 12.1.1 | In `competitor-metrics.pipeline.ts`, change the context type cast and property access from `.rawData?.domainAuthority?.domain_rating` to `.domain_authority?.domain_rating` for both `targetDomainRating` and `targetReferringDomains` | [x] |
| 12.1.2 | Run `npx tsc --noEmit` in `server/` — must pass clean | [x] |
| 12.1.3 | Do a live workflow run and verify the competitor-metrics step output contains a non-zero `targetDomainRating` | [x] |

**Why:** The dedup optimisation from the prior session removed the live Ahrefs DR call and replaced it with a context read. The read path was `context['business-profile'].rawData?.domainAuthority?.domain_rating`. However, `context['business-profile']` is the Claude agent's output JSON, whose schema is `{ business_name, industry, domain_authority: { domain_rating, referring_domains }, … }` — there is no `.rawData` wrapper. The `.rawData` property is always `undefined`, so `targetDomainRating` and `targetReferringDomains` are always `0`. The `verdict-strategy` agent subsequently receives a target DR of 0 for every run, making all competitive gap analysis wrong.

**Evidence:** `competitor-metrics.pipeline.ts` lines ~71–76. `business-profile.agent.md` output schema — top-level field is `domain_authority`, not `rawData.domainAuthority`. `workflow.service.ts` `setContext()` call stores `agentResult.output`, not the pipeline's intermediate object.

**File:** `server/src/features/workflows/pipelines/competitor-metrics.pipeline.ts`

---

#### 12.2 Fix method03-content-gap: 9 Ahrefs calls wasted + LLM produces empty output every run

| # | Task | Status |
|---|------|--------|
| 12.2.1 | Read `method03-content-gap.pipeline.ts` — confirm it fetches `getOrganicKeywords(500)` for target + `getOrganicKeywords(200)` per competitor (9+ calls total) and stores result as `rawData.targetKeywords` + `rawData.competitorKeywordsResults` | [x] |
| 12.2.2 | Read `method03-content-gap.agent.md` — confirm `execution_type: pipeline-then-agent` | [x] |
| 12.2.3 | Read `method03-content-gap.prompt.md` — locate the `{{imported-keywords}}` reference and understand what data it expects | [x] |
| 12.2.4 | Decision point (choose one): **Option A** — Gate the pipeline: if `context['imported-keywords']` does not exist in workflowContext, skip all 9 Ahrefs calls and return `{ gapKeywords: [], skipped: true }` immediately. Update the prompt to handle the skipped case. **Option B** — Fix the prompt: remove the `{{imported-keywords}}` reference and instead instruct Claude to analyse the Ahrefs content gap data that is already in `<pipeline_data>` (`.rawData.targetKeywords` vs `.rawData.competitorKeywordsResults`). | [x] |
| 12.2.5 | Implement the chosen option | [x] |
| 12.2.6 | Run `npx tsc --noEmit` — must pass clean | [x] |
| 12.2.7 | Run a workflow to verify method03 either skips correctly (Option A) or produces a populated `gapKeywords[]` (Option B) | [x] |

**Why:** The `method03-content-gap` prompt reads `{{imported-keywords}}` to get a list of keywords the user has manually imported. `prompt.service.ts`'s `interpolate()` resolves this against `workflowContext['imported-keywords']`. No step in the workflow ever writes a key called `imported-keywords` into context — it does not exist. Claude therefore receives an empty string for the variable and concludes there are no keywords to gap-analyse. It outputs an empty `gapKeywords: []` every single run. The pipeline still executes all 9 Ahrefs API calls before Claude gets the empty prompt. This is a complete waste: 9 Ahrefs credits per run, 1 LLM call, zero useful output.

**Evidence:** `method03-content-gap.prompt.md` — search for `imported-keywords`. `workflow.service.ts` and `workflow.processor.ts` — grep for `imported-keywords` (result: zero writes). `method03-content-gap.pipeline.ts` — confirm the API calls run unconditionally.

**Files:** `server/src/features/workflows/pipelines/method03-content-gap.pipeline.ts`, `server/src/prompts/research/method03-content-gap.prompt.md`

---

### P1 — Guaranteed duplicate API calls running every workflow

#### 12.3 Eliminate method02-seed-expansion duplicate API calls (40 calls per run)

| # | Task | Status |
|---|------|--------|
| 12.3.1 | Read `seed-keywords.pipeline.ts` and `method02-seed-expansion.pipeline.ts` side by side — confirm they call the same Ahrefs `getRelatedKeywords` and DataForSEO `getKeywordSuggestions` endpoints for the same seed list | [x] |
| 12.3.2 | Read `method02-seed-expansion.pipeline.ts` — confirm the early-return guard checks `context['seed-keywords'].rawData?.relatedTerms`, which is always `undefined` (rawData never in context) | [x] |
| 12.3.3 | Read `method02-seed-expansion.prompt.md` — assess whether the Claude expansion step produces output that is meaningfully different from what `seed-keywords` agent already produces | [x] |
| 12.3.4 | Decision point: **Option A** (recommended) — Remove `method02-seed-expansion` as a workflow step entirely. Update `method03-content-gap.agent.md` (and any other agent that lists `method02-seed-expansion` in `depends_on`) to remove or replace the dependency. **Option B** — Rewrite the method02 pipeline to read from `context['seed-keywords'].seedKeywords` (the Claude agent output, which already contains a deduped, scored keyword list) and perform only the incremental work that seed-keywords does not already do — e.g. question-intent expansion or long-tail modifiers. No API calls needed; the data is already in context. | [x] |
| 12.3.5 | Implement chosen option. If Option A: also remove the method02 agent.md and prompt.md, and delete the pipeline file (or keep as dead code clearly marked). | [x] |
| 12.3.6 | Run `npx tsc --noEmit` — must pass clean | [x] |
| 12.3.7 | Run a full workflow — verify the method02 step is either absent or runs without API calls | [x] |

**Why:** `seed-keywords.pipeline.ts` calls `getRelatedKeywords(seed)` for each of the ~20 seed terms (20 Ahrefs calls) and `getKeywordSuggestions(seed)` for each seed (20 DataForSEO calls). The Claude agent for seed-keywords then synthesises these into `seedKeywords[]` with scoring and category labels. `method02-seed-expansion.pipeline.ts` fetches the exact same data again — same endpoints, same seeds, same limit parameters. The early-return optimisation that was supposed to reuse prior data checks `context['seed-keywords'].rawData?.relatedTerms`, but `rawData` is not in context. The check always fails and all 40 calls always fire. Total: 40 duplicate credits per workflow run. The method02 LLM step then produces an `expandedKeywords[]` that is largely identical to the `seedKeywords[]` that seed-keywords already computed.

**Evidence:** Compare `seed-keywords.pipeline.ts` lines ~80–140 with `method02-seed-expansion.pipeline.ts` lines ~50–110. Both call `getRelatedKeywords` + `getKeywordSuggestions` with the same seed list. Check `method02-seed-expansion.pipeline.ts` early-return guard around line ~49 — condition is `context['seed-keywords'].rawData?.relatedTerms`.

**Files:** `server/src/features/workflows/pipelines/method02-seed-expansion.pipeline.ts`, `server/src/agents/definitions/method02-seed-expansion.agent.md`, `server/src/agents/definitions/method03-content-gap.agent.md` (update depends_on)

---

## Backlog

### Forum Intelligence — Reddit Date Resolution via OAuth

**Context:** The Forum Date Enricher (`forum-date-enricher.service.ts`) cannot reliably resolve `publishedDate` for Reddit posts from AWS EC2 IPs. Root causes confirmed via diagnostics:
- `reddit.com` direct API: HTTP 403 (AWS IP blocked)
- Wayback Machine CDX: works for pre-2023 posts, but 503/connection failure for recent posts
- Quora: CDX 403 (robots.txt exclusion), Firecrawl returns 1.75MB with no standard date metadata

**Fix:** Implement Reddit OAuth (script app) to call `GET /r/{sub}/comments/{id}/.json` with a Bearer token. Reddit's OAuth API is not IP-restricted and returns `created_utc` (Unix seconds) reliably for every post.

**Steps:**
1. Register a Reddit "script" app at https://reddit.com/prefs/apps — get `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`
2. Add env vars to EC2: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`
3. In `forum-date-enricher.service.ts`, add `getRedditAccessToken()` method: POST to `https://www.reddit.com/api/v1/access_token` with Basic auth (client_id:client_secret) and `grant_type=client_credentials`
4. Cache the token (expires in 1 hour) in a private field; refresh when expired
5. Replace `resolveRedditDate()` body: call `GET https://oauth.reddit.com/r/{sub}/comments/{id}/.json?raw_json=1&limit=1` with `Authorization: Bearer {token}` header; parse `created_utc`
6. Keep Wayback CDX as fallback if OAuth fails

**Expected outcome:** ~50% of forum opportunities (all Reddit posts) get accurate `publishedDate`. Quora remains on Wayback CDX (limited coverage for older posts only).

**Files to change:** `server/src/features/content/forum-date-enricher.service.ts` (±30 lines), `.env` / EC2 environment

---

#### 12.4 Fix phase1-baseline: duplicate Ahrefs getOrganicKeywords call every run

| # | Task | Status |
|---|------|--------|
| 12.4.1 | Read `phase1-baseline.pipeline.ts` — locate the guard that checks `context['seed-keywords'].rawData?.organicKeywords` and the fallback Ahrefs `getOrganicKeywords(domain, country, 50)` call | [x] |
| 12.4.2 | Read `seed-keywords.agent.md` output schema — confirm `seedKeywords[]` is the available output and what fields each entry carries (keyword, volume, difficulty, position, intent, etc.) | [x] |
| 12.4.3 | Rewrite the phase1-baseline pipeline to read `context['seed-keywords'].seedKeywords` as its keyword base instead of calling Ahrefs again. Map the seedKeywords array to whatever shape the rest of the pipeline + Claude prompt expects for organic keyword data. | [x] |
| 12.4.4 | Remove the dead early-return guard (the one checking `.rawData`) entirely | [x] |
| 12.4.5 | Run `npx tsc --noEmit` — must pass clean | [x] |
| 12.4.6 | Run a workflow and verify phase1-baseline does not make a `getOrganicKeywords` Ahrefs call (check logs or Ahrefs usage) | [x] |

**Why:** `seed-keywords.pipeline.ts` calls `getOrganicKeywords(domain, country, 50)` as its first step. The Claude agent for seed-keywords processes these 50 keywords into a scored, categorised `seedKeywords[]` list. `phase1-baseline.pipeline.ts` then calls the same `getOrganicKeywords(domain, country, 50)` again. The early-return guard that was supposed to reuse the seed-keywords data checks `context['seed-keywords'].rawData?.organicKeywords`, which is always `undefined` because rawData is not stored in context. The fallback fires unconditionally every run, duplicating 1 Ahrefs credit and ~2 seconds of latency. Unlike method02 (which is entirely duplicate), phase1-baseline does do unique work after this call (organic pages, quick-win filter analysis), so the fix is to read from the correct context key rather than remove the step.

**Evidence:** `phase1-baseline.pipeline.ts` guard around line ~30–34. `seed-keywords.agent.md` output schema defines `seedKeywords: [{ keyword, volume, difficulty, currentPosition?, intent, … }]`. These fields are sufficient for the baseline ranking analysis the prompt performs.

**Files:** `server/src/features/workflows/pipelines/phase1-baseline.pipeline.ts`

---

#### 12.5 Cap serp-niche-map at 20 seeds (saves 30 Ahrefs calls and ~33s per run)

| # | Task | Status |
|---|------|--------|
| 12.5.1 | In `serp-niche-map.pipeline.ts`, find `seedKeywords.slice(0, 50)` and change to `seedKeywords.slice(0, 20)` | [x] |
| 12.5.2 | Run `npx tsc --noEmit` — must pass clean | [x] |
| 12.5.3 | Optionally: read `serp-niche-map.prompt.md` to confirm the Claude prompt does not reference a minimum SERP count that would be violated by 20 seeds | [x] |

**Why:** The serp-niche-map pipeline calls `getSerpOverview(keyword)` for up to 50 seeds with a 1,100ms delay between calls (to avoid Ahrefs rate-limit). This means a minimum wall time of 55 seconds just for this step, plus 50 Ahrefs SERP credits per run. The niche map output — 5 niche segments, dominant players, content type distribution by intent — is consumed only by `competitor-buckets` for corroborating competitor classification. Auditing the actual prompt and the downstream usage shows niche map quality does not improve meaningfully past 20–25 well-representative keywords. 30 seeds beyond 20 add noise (long-tail variants of already-represented intents) rather than new segments. Cutting to 20 saves 30 Ahrefs credits and ~33 seconds of pipeline latency per workflow run with no meaningful quality loss.

**Evidence:** `serp-niche-map.pipeline.ts` — find the `slice(0, 50)` call. `competitor-buckets.prompt.md` — note that it uses niche map only as one corroborating signal among several (competing domains, Serper results).

**Files:** `server/src/features/workflows/pipelines/serp-niche-map.pipeline.ts`

---

### P2 — Context explosion and stale prompt instructions

#### 12.6 Slice workflowContext before passing to late-stage LLM calls

| # | Task | Status |
|---|------|--------|
| 12.6.1 | Read `agent.runtime.ts` `buildUserMessage()` — confirm that the full `workflowContext` JSON is serialised and injected as `<workflow_context>` into every LLM call | [x] |
| 12.6.2 | Read the prompts for `consolidated-keywords`, `verdict-strategy`, and `topical-map` — for each, list the exact `{{variable}}` interpolations used. These are the only context keys each step actually needs. | [x] |
| 12.6.3 | Measure the approximate token count of `workflowContext` at the `consolidated-keywords` step by logging `JSON.stringify(context).length` in a test run (rough guide: length / 4 ≈ tokens) | [x] |
| 12.6.4 | Add a `contextKeys?: string[]` field to the `AgentDefinition` interface in `agent.runtime.ts` / the agent definition schema. If set, `buildUserMessage()` slices `workflowContext` to only include keys listed. If absent, current behaviour (full context) is preserved for backwards compat. | [x] |
| 12.6.5 | Update `consolidated-keywords.agent.md` — add `contextKeys: [method01-competitor-pages, method02-seed-expansion, method03-content-gap-import, seed-keywords]` | [x] |
| 12.6.6 | Update `verdict-strategy.agent.md` — add `contextKeys: [business-profile, site-audit, ai-intelligence, competitor-buckets, competitor-metrics, consolidated-keywords]` | [x] |
| 12.6.7 | Update `topical-map.agent.md` — add `contextKeys: [consolidated-keywords, verdict-strategy, business-profile]` | [x] |
| 12.6.8 | Run `npx tsc --noEmit` — must pass clean | [x] |
| 12.6.9 | Run a workflow — verify output quality is unchanged, and log that `<workflow_context>` block is smaller at these three steps | [x] |

**Why:** `agent.runtime.ts` `buildUserMessage()` serialises the full `workflowContext` object (all accumulated prior step outputs as raw JSON) and injects it into every agent call. By the time `consolidated-keywords` runs (step ~12 of 18), the context JSON includes: the business-profile agent output, site-audit output, ai-intelligence output, competitor-buckets output, competitor-metrics output (6 competitors × 3 API results each), seed-keywords output (50+ keywords), phase1-baseline output, method01 output (6 × 50 pages), method02 output (hundreds of expanded keywords), and serp-niche-map output (50 SERP results × 10 listings). Conservative estimate: 80–100K tokens of context injected into every one of the last three LLM calls, most of which is irrelevant to the specific step. At `claude-sonnet-4` pricing this is the dominant cost driver. Each step already uses `{{variable}}` interpolation to pull the specific fields it needs — the full context block is redundant noise that also increases latency (larger prompts = slower TTFT).

**Evidence:** `agent.runtime.ts` `buildUserMessage()` — the `<workflow_context>` assembly. `consolidated-keywords.prompt.md`, `verdict-strategy.prompt.md`, `topical-map.prompt.md` — count the number of distinct context keys each references vs the total number of steps whose output accumulates in context.

**Files:** `server/src/agents/agent.runtime.ts`, `server/src/agents/definitions/consolidated-keywords.agent.md`, `server/src/agents/definitions/verdict-strategy.agent.md`, `server/src/agents/definitions/topical-map.agent.md`

---

#### 12.7 Update 4 stale prompts that reference blocked tools

| # | Task | Status |
|---|------|--------|
| 12.7.1 | In `research/phase1-baseline.prompt.md`: remove the "Available Tools" / "Tool Budget" section listing `ahrefs_organic_keywords`, `ahrefs_keyword_difficulty`, `dataforseo_serp`. Add a note in the EXECUTION MODEL section stating the pipeline pre-fetches organic keyword data and delivers it in `<pipeline_data>`. | [x] |
| 12.7.2 | In `research/method01-competitor-pages.prompt.md`: remove the tool list (`ahrefs_organic_pages`, `ahrefs_organic_keywords`, `dataforseo_serp`, `serper_search`). **CTO audit (June 2026) found 3 residual defects fixed in this pass:** (a) anti-hallucination rule 1 still said keywords "MUST come from Ahrefs tool responses" — corrected to `pipeline_data`; (b) step-by-step workflow still instructed `ahrefs_organic_pages` / `ahrefs_organic_keywords` tool calls — replaced with pipeline-data read instructions; (c) execution model note said "per-page keyword data is not available" — corrected after task 12.8 added `keywords[]` per competitor to pipeline_data. | [x] |
| 12.7.3 | In `research/method02-seed-expansion.prompt.md`: remove the tool list (`ahrefs_related_keywords`, `dataforseo_keyword_suggestions`, `serper_search`, `dataforseo_keyword_volume`). If method02 is removed in task 12.3, delete this file entirely. | [x] |
| 12.7.4 | In `content/content-brief.prompt.md`: remove the "Tool Budget: serper_search max 3, firecrawl_scrape max 2" line. **CTO audit (June 2026) found 3 residual defects fixed in this pass:** (a) Instructions step 1 still said "use `serper_search`" — replaced with "use `serpResults` in `<pipeline_data>`"; (b) Instructions step 2 still said "use `firecrawl_scrape`" — replaced with "use `scrapedPages` in `<pipeline_data>`"; (c) Task section said "using the available tools" — removed; (d) Target Market line had stale `serper_search` country note — removed. | [x] |
| 12.7.5 | In `competitors/competitor-metrics.prompt.md`: change "EXECUTION MODEL: Agent-with-tools" to "EXECUTION MODEL: Pipeline-only (no LLM)" since this step's `execution_type` is `pipeline-only` and this prompt is never loaded. | [x] |

**Why:** When `allowedTools: []` is set on a `pipeline-then-agent` step, the Claude agent receives the system prompt and user message but the `tools:` array passed to the API is empty. Claude is told in these prompts that it has specific tools available and should use them, but any attempt to call a tool fails silently — Claude either hallucinates a tool response or produces degraded output. Stale tool references are an active prompt correctness problem: Claude reasons about tool availability and may adjust its output strategy based on tools it believes it can call. Removing the references ensures Claude reasons correctly about the data it actually has.

**Evidence:** `workflow.processor.ts` — confirm `allowedTools` is `[]` for `pipeline-then-agent` steps (tools list comes from agent definition, and these agents no longer list tools). Each of the 4 prompt files — search for "Tool Budget", "Available Tools", "Tools:", "serper_search", "ahrefs_".

**Files:** `server/src/prompts/research/phase1-baseline.prompt.md`, `server/src/prompts/research/method01-competitor-pages.prompt.md`, `server/src/prompts/research/method02-seed-expansion.prompt.md`, `server/src/prompts/content/content-brief.prompt.md`, `server/src/prompts/competitors/competitor-metrics.prompt.md`

---

### P3 — Method01 keyword gap is empty (low-value step)

#### 12.8 Fix method01-competitor-pages: Claude receives zero per-page keyword data

| # | Task | Status |
|---|------|--------|
| 12.8.1 | Read `method01-competitor-pages.pipeline.ts` — confirm what data the pipeline provides to Claude: page URLs, traffic estimates, page titles. Confirm there are no per-page keyword lists in the pipeline output. | [x] |
| 12.8.2 | Read `method01-competitor-pages.prompt.md` — confirm Claude is expected to produce `discoveredKeywords[]` per competitor. Assess whether page-URL + traffic data alone is sufficient to produce a useful keyword gap list. | [x] |
| 12.8.3 | Check `competitor-metrics.pipeline.ts` output schema — note that it already fetches `getOrganicKeywords(competitor, 20)` for each competitor. | [x] |
| 12.8.4 | Decision point: **Option A** — Add per-page keyword fetching to the method01 pipeline. For the top 5 pages per competitor (by traffic), call `getOrganicKeywords(pageUrl, 20)`. That is 5 pages × 6 competitors = 30 Ahrefs calls. Claude then has keyword data per page to fill `discoveredKeywords[]`. **Option B** — Repurpose method01 to use `competitor-metrics` data already in context. The method01 Claude call becomes a classification/gap-analysis step over the 20 organic keywords per competitor that `competitor-metrics` already fetched. No new API calls. Pipeline output scope reduced to page structure/depth signals only. | [x] |
| 12.8.5 | Implement chosen option | [x] |
| 12.8.6 | Run `npx tsc --noEmit` — must pass clean | [x] |
| 12.8.7 | Run a workflow — verify `method01` output `discoveredKeywords[]` is non-empty | [x] |

**Why:** The method01 pipeline provides each competitor's top 50 pages with traffic estimates. The Claude prompt instructs the agent to "extract discoveredKeywords for each competitor" using `ahrefs_organic_keywords` per page. But `allowedTools: []` — Claude cannot call any tools. Without per-page keyword data and without tool access, Claude can only infer intent from page titles and URL slugs. The `discoveredKeywords[]` output is therefore either empty or fabricated from page title text, not real keyword data. This output feeds into `consolidated-keywords`, which uses it as one of four keyword sources. A hollow method01 output reduces consolidated-keywords quality.

**Evidence:** `method01-competitor-pages.pipeline.ts` output — no `organicKeywords` per page. `method01-competitor-pages.prompt.md` — instructions reference tool calls that are blocked. `competitor-metrics.pipeline.ts` — already fetches `getOrganicKeywords(competitor, 20)` for 6 competitors (verified data exists).

**Files:** `server/src/features/workflows/pipelines/method01-competitor-pages.pipeline.ts`, `server/src/prompts/research/method01-competitor-pages.prompt.md`

---

### QA Gate: Release 12

| # | Verification | Status |
|---|-------------|--------|
| QA-12.1 | Run full workflow — `competitor-metrics` output shows non-zero `targetDomainRating` and `targetReferringDomains` | [ ] |
| QA-12.2 | Run full workflow — `method03-content-gap` output is either correctly skipped (Option A) or contains populated `gapKeywords[]` (Option B) | [ ] |
| QA-12.3 | Run full workflow — `method02-seed-expansion` step is absent (Option A) or makes zero Ahrefs/DataForSEO calls (Option B) | [ ] |
| QA-12.4 | Run full workflow — `phase1-baseline` makes zero `getOrganicKeywords` Ahrefs calls (confirm via logs) | [ ] |
| QA-12.5 | Run full workflow — `serp-niche-map` makes exactly 20 SERP calls (not 50) | [ ] |
| QA-12.6 | Log `<workflow_context>` block size at `consolidated-keywords`, `verdict-strategy`, `topical-map` — confirm reduction of ≥50% vs before | [ ] |
| QA-12.7 | `consolidated-keywords`, `verdict-strategy`, `topical-map` output quality unchanged or improved (spot-check on a real run) | [ ] |
| QA-12.8 | No stale tool references remain in the 4 updated prompts (grep `ahrefs_|serper_search|firecrawl_scrape|Tool Budget` across those files) | [ ] |
| QA-12.9 | `method01-competitor-pages` output `discoveredKeywords[]` is non-empty for at least 3 of 6 competitors | [ ] |
| QA-12.10 | `npx tsc --noEmit` passes in `server/` after all changes | [ ] |
| QA-12.11 | `npx tsc --noEmit` passes in `frontend/` (no accidental regressions) | [ ] |
| QA-12.12 | Run workflow end-to-end — `verdict-strategy` output contains accurate competitive positioning data (not corrupted by zero DR) | [ ] |

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
