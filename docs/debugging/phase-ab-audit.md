# Phase A+B Implementation Audit

**Date**: May 11, 2026  
**Scope**: All files created in Phase A (Foundation) and Phase B (Agent Runtime + Workflow Engine)  
**Outcome**: 15 Critical, 22 Warnings, 12 Info items

---

## Executive Summary

The scaffolding is structurally complete — all modules compile (`tsc --noEmit` passes), dependencies resolve, and the NestJS DI graph is valid. However, there are **serious security and data-integrity gaps** that must be addressed before any production use or Phase D agent execution.

**Top 3 Blockers for Production:**
1. **Authorization bypass** — Every controller trusts client-supplied `organizationId` without verifying membership
2. **Workflow steps never enqueue** — `enqueuePendingSteps()` marks steps as `running` but never calls `queue.add()`
3. **Credit race condition** — Parallel steps pass pre-check then both debit, causing overdraft or failure after execution

---

## CRITICAL Issues (Must Fix Before Phase C/D)

### Security — Authorization

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| S1 | No org membership check on any controller endpoint | All controllers | Any authed user can CRUD any org's data |
| S2 | Credits endpoints — any user can view/spend any org's credits | `credits.controller.ts` | Financial fraud |
| S3 | WebSocket gateway — no auth on connect, `cors: '*'`, any user can subscribe to any workflow | `workflow.gateway.ts` | Data leakage |
| S4 | Swagger docs unconditionally exposed in production | `main.ts` | API schema exposure |

### Data Integrity — Schema

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| D1 | No `ON DELETE CASCADE` on any FK — orphaned records on deletion | `schema.ts` (all FKs) | Orphaned data |
| D2 | Optional FK fields (`workflowRunId`, `keywordId`) have no FK constraint | `keywords`, `contentPieces`, `reports` | Invalid references |
| D3 | No unique constraint on `(projectId, keyword)` | `keywords` table | Duplicate keywords |
| D4 | Credit ledger: no FK on `workflowRunId`, no check constraint on `amount` | `creditLedger` | Silent corruption |

### Workflow Engine — Correctness

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| W1 | **`enqueuePendingSteps()` never calls `queue.add()`** — steps stuck in `running` forever | `workflow.service.ts` | Workflow completely non-functional |
| W2 | Credit debit happens AFTER artifact persistence — if debit fails, step appears complete but credits weren't charged | `workflow.processor.ts` | Revenue loss |
| W3 | Artifact version hardcoded to `1` — re-execution creates duplicates | `workflow.processor.ts` | Data corruption |
| W4 | Race condition in dependency resolution — stale reads allow steps to run when deps failed | `workflow.service.ts` | Invalid state |
| W5 | Credit pre-check vs debit not atomic — parallel steps can overdraft | `workflow.processor.ts` | Overspending |
| W6 | WebSocket events defined but never emitted from processor/service | `workflow.gateway.ts` | Dead code, no real-time updates |
| W7 | No agent definition validation at workflow start — fails mid-execution | `workflow.processor.ts` | Wasted resources |

---

## WARNING Issues (Fix This Sprint)

### Agent Runtime

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| A1 | `finish_reason='length'` (token limit hit) treated as normal completion | `agent.runtime.ts` | Check for `length` and retry with shorter context or mark as failed |
| A2 | Malformed tool arguments fall through as raw string | `agent.runtime.ts` | Validate parsed input matches schema |
| A3 | Message history grows unbounded per iteration | `agent.runtime.ts` | Truncate/summarize after N iterations |
| A4 | Output validator only checks top-level properties | `output.validator.ts` | Add nested object validation |
| A5 | YAML parser too simplistic — can't handle colons in values | `prompt.service.ts` | Use `js-yaml` library |

### Integration Services

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| I1 | No HTTP timeouts on any `fetch()` call | All integration services | Add `AbortSignal.timeout(10000)` |
| I2 | No retry logic for transient failures (429, 5xx) | All integration services | Add exponential backoff |
| I3 | PromptService cache unbounded in production | `prompt.service.ts` | Add LRU eviction or TTL |
| I4 | API response bodies logged on error (may contain sensitive data) | All integration services | Sanitize error logs |
| I5 | SerperService `searchBatch()` — sequential loop with no rate limiting | `serper.service.ts` | Add delay between requests |

### Input Validation

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| V1 | No DTO classes with class-validator decorators | All controllers | Create DTOs with validation |
| V2 | No length limits on name/slug/domain fields | workspaces, projects | Add `@MaxLength()` |
| V3 | No format validation on slugs | workspaces, projects | Add regex pattern |

### Database

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| DB1 | Missing indexes on `stepApprovals`, `topicalMaps`, `contentPieces`, `reports` | `schema.ts` | Add composite indexes |
| DB2 | Missing `updatedAt` on `orgMembers` and `reports` | `schema.ts` | Add column |
| DB3 | Timestamps lack `withTimezone: true` | `schema.ts` (all tables) | Add option |
| DB4 | JSON columns have no TypeScript type annotations (`$type<T>()`) | `schema.ts` | Define interfaces |

### Infrastructure

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| INF1 | Redis runs without authentication | `docker-compose.yml` | Add `--requirepass` |
| INF2 | Hardcoded default DB credentials identical across all files | `docker-compose.yml`, `drizzle.config.ts`, `db/index.ts` | Require explicit env var |
| INF3 | No graceful shutdown hooks | `main.ts` | Add `app.enableShutdownHooks()` |

### Frontend

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| FE1 | Missing CSS variables referenced by button/card/avatar components | `globals.css` | Define variables |
| FE2 | Missing `aria-label` on interactive elements | top-bar, side-nav, command-palette | Add labels |

---

## INFO Items (Track in Technical Debt)

| # | Issue | Notes |
|---|-------|-------|
| 1 | No ESLint config or dependencies in server | Lint script exists but can't run |
| 2 | TypeScript target mismatch (server ES2021 vs base ES2022) | Document or align |
| 3 | No env validation at startup (ConfigModule has no schema) | Add Joi/Zod validation |
| 4 | No soft deletes on any table | Consider for audit trail |
| 5 | `projects` table has redundant `organizationId` (derivable from workspace) | Document reasoning or remove |
| 6 | `stepArtifacts` has redundant `workflowRunId` (derivable from step) | Document reasoning (denormalization for query speed) |
| 7 | No build/prod startup scripts in root `package.json` | Add when needed |
| 8 | Health module exists but no `/health` endpoint exposed | Wire up health checks |
| 9 | No circuit breaker for external API calls | Consider for production resilience |
| 10 | Seed file creates minimal data (1 org, 1 workspace, 1 project) | Expand for testing |
| 11 | Keyword vs Content status models overlap — relationship unclear | Document lifecycle |
| 12 | `workflowContext` table — too flexible, no key validation | Define enum of valid keys |

---

## Recommended Fix Order

### P0 — Block Phase C/D (fix immediately)

1. **W1**: Wire `@InjectQueue` + `queue.add()` in `workflow.service.ts` (~15 min)
2. **S1-S3**: Add org membership guard middleware (~2 hours)
3. **W2**: Move credit debit before artifact persistence (~30 min)
4. **W3**: Compute `MAX(version) + 1` for artifact versioning (~15 min)
5. **D1**: Add `onDelete: 'cascade'` to child table FKs + new migration (~1 hour)

### P1 — Before first agent execution (Phase D)

6. **A1**: Handle `finish_reason='length'` in agent runtime
7. **I1**: Add HTTP timeouts to all integration services
8. **W4**: Wrap `enqueuePendingSteps` in transaction with advisory lock
9. **W5**: Move credit debit to pre-execution (reserve/debit pattern)
10. **W6**: Wire WebSocket event emissions in processor

### P2 — Before production deployment

11. **INF1-3**: Redis auth, env validation, shutdown hooks
12. **V1-V3**: DTO validation layer
13. **DB1-4**: Indexes, timestamps, type annotations
14. **I2-5**: Retry logic, rate limiting, cache bounds

---

## What's Working Well

- Module structure is clean and follows NestJS conventions
- All DI dependencies resolve correctly (`tsc --noEmit` clean)
- Schema covers the full domain model (15 tables, 13 enums)
- Agent runtime loop logic is fundamentally sound
- Integration services cover all required APIs
- Frontend shell has correct component boundaries (client/server)
- Clerk auth + middleware correctly protects routes
- BullMQ configuration is correct
- No XSS vulnerabilities in frontend
- No SQL injection risks (Drizzle ORM parameterizes all queries)
