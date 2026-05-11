# Phase A+B+C Comprehensive Audit Report

> **Auditor**: Principal Staff Engineer (CTO review)
> **Date**: May 11, 2026
> **Scope**: Full codebase audit of Phases A (Foundation), B (Agent Runtime), C (Workflow UI)
> **Branch**: `UIUX`

---

## Executive Summary

| Severity | Count | Impact |
|----------|-------|--------|
| **P0 — Showstopper** | 6 | Blocks production deployment |
| **P1 — Critical** | 8 | Functional breakage or security hole |
| **P2 — Warning** | 12 | Should fix before launch |
| **P3 — Info** | 9 | Tech debt / improvement opportunities |

**Verdict**: The implementation has solid architectural bones but contains **6 showstopper bugs** that make the system non-functional end-to-end. Primary gaps: (1) frontend cannot authenticate API calls, (2) tools never registered so agents can't call them, (3) authorization bypass on resource-specific routes, (4) race condition in step enqueuing.

---

## P0 — Showstoppers (MUST FIX IMMEDIATELY)

### P0-1: Frontend API calls have no auth token
**File**: `frontend/src/shared/utils/api.ts:27-33`
**Issue**: `apiFetch()` never includes an `Authorization: Bearer <token>` header. All authenticated endpoints return 401.
**Impact**: Entire frontend is non-functional — no data can be loaded, no workflows started, no approvals submitted.
**Fix**: Create an authenticated fetch wrapper that uses `@clerk/nextjs` `getToken()`:
```typescript
// Add: headers: { 'Authorization': `Bearer ${await getToken()}` }
```

### P0-2: ToolRegistry never has tools registered
**File**: `server/src/agents/tool.registry.ts:15`
**Issue**: `register()` is defined but never called anywhere in the codebase. The registry is permanently empty.
**Impact**: Every agent step fails immediately because `getOpenAiToolDefs()` returns `[]` — no tools are available for function calling.
**Fix**: Create a tool registration bootstrap service (OnModuleInit) that registers each integration service as a tool.

### P0-3: Authorization bypass — resource `:id` routes not validated
**Files**:
- `server/src/features/organizations/organizations.controller.ts:15,20,24` — `:id` param
- `server/src/features/workspaces/workspaces.controller.ts:20,33,39` — `:id` param
- `server/src/features/projects/projects.controller.ts:16` — `:id` param

**Issue**: `OrgMembershipGuard` checks `params.organizationId` or `params.orgId`, but these controllers use `:id`. The guard silently passes because `targetOrgId` is `undefined`.
**Impact**: Any authenticated user can read/edit/delete ANY other org's workspaces, projects, and orgs by UUID.
**Fix**: Either rename params to `:organizationId` where applicable, OR add explicit ownership checks in each service method.

### P0-4: Run `creditsUsed` overwritten instead of incremented
**File**: `server/src/features/workflows/workflow.processor.ts:145-149`
**Issue**: `.set({ creditsUsed: agentDef.creditCost })` — overwrites run's total with just the current step's cost. After step 2, the run shows step 2's cost only.
**Impact**: Billing data is wrong; credits dashboard shows incorrect totals.
**Fix**: Use `sql\`credits_used + ${agentDef.creditCost}\`` or fetch-and-increment.

### P0-5: `organizationId=""` hardcoded in workflow runs page
**File**: `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/workflows/page.tsx:36`
**Issue**: `<StartRun organizationId="" .../>` — passes empty string to backend.
**Impact**: `createRun()` will fail or create a run with no org association.
**Fix**: Resolve org ID from user context (Clerk session) or from project data.

### P0-6: workflow-shell refetches on every step click
**File**: `frontend/src/features/workflow/components/workflow-shell.tsx:62`
**Issue**: `fetchRun` depends on `[runId, activeStepKey]`. Clicking any step changes `activeStepKey` → triggers full refetch.
**Impact**: UI flickers, unnecessary API calls on every navigation, possible race conditions if responses arrive out of order.
**Fix**: Remove `activeStepKey` from `useCallback` deps; use a ref for the initial-auto-select logic.

---

## P1 — Critical (Functional/Security Bugs)

### P1-1: Race condition in concurrent step enqueuing
**File**: `server/src/features/workflows/workflow.service.ts:110-140`
**Issue**: `enqueuePendingSteps()` wraps read+mark as transaction, but enqueues OUTSIDE transaction. Two concurrent processor completions can both read the same pending step before either commits its update, resulting in double-enqueue.
**Fix**: Use `SELECT ... FOR UPDATE` on the pending step row, or add BullMQ deduplication via `jobId: {runId}:{stepKey}`.

### P1-2: Input validation absent — no DTOs anywhere
**Files**: All controllers (organizations, workspaces, projects, credits, workflows)
**Issue**: `@Body() body: { ... }` uses inline types, not `class-validator` DTOs. Despite `ValidationPipe` being global, it has nothing to validate against. Malformed/oversized payloads pass through.
**Impact**: Potential for unexpected data in DB, application crashes on edge-case inputs.
**Fix**: Create DTO classes with decorators (`@IsString()`, `@IsUUID()`, `@MaxLength()`, etc.)

### P1-3: OutputValidator injected but never called
**File**: `server/src/features/workflows/workflow.processor.ts:35`
**Issue**: `OutputValidator` is imported and DI-resolved, but `validate()` is never called on agent output before persisting.
**Impact**: Malformed agent output persisted as artifact → downstream steps receive garbage data.
**Fix**: After line 104 (artifact insert), call `this.outputValidator.validate(result.output, agentDef.outputSchema)` and log warnings.

### P1-4: No retry/backoff configuration on BullMQ jobs
**File**: `server/src/features/workflows/workflows.module.ts:10`
**Issue**: `BullModule.registerQueue({ name: 'workflow-steps' })` has no `defaultJobOptions`. Failed jobs are not retried.
**Impact**: Any transient failure (network hiccup, API rate limit) permanently fails the step.
**Fix**: Add `defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }`.

### P1-5: ConfigModule has no env validation schema
**File**: `server/src/app.module.ts:35`
**Issue**: No Joi/class-validator schema validating required env vars at startup. Missing `OPENAI_API_KEY`, `CLERK_WEBHOOK_SECRET`, etc. won't fail until runtime.
**Fix**: Add `validationSchema` or `validate` option to ConfigModule.forRoot().

### P1-6: Webhook has no replay protection
**File**: `server/src/features/auth/auth.controller.ts`
**Issue**: No deduplication of webhook events. If Clerk retries a webhook (e.g., `organization.created`), duplicate orgs may be created.
**Fix**: Store svix message ID and reject duplicates.

### P1-7: Credit debit not atomic with artifact persistence
**File**: `server/src/features/workflows/workflow.processor.ts:56-104`
**Issue**: Credits debited at line 56, artifact persisted at line 98. If process crashes between these, credits are lost with no artifact/audit trail.
**Fix**: Wrap debit + artifact + step update in a single DB transaction.

### P1-8: No input sanitization on project `domain` field
**File**: `server/src/features/projects/projects.controller.ts:27`
**Issue**: `domain` field accepted without validation. Could contain scripts, extremely long strings, or invalid hostnames. Used later in Ahrefs/PageSpeed API calls.
**Fix**: Add DTO with `@IsUrl()` or regex validation for domain format.

---

## P2 — Warnings (Should Fix Before Launch)

| # | File | Issue |
|---|------|-------|
| W1 | `server/src/db/index.ts:5` | DB connection string fallback has hardcoded credentials |
| W2 | `infra/docker-compose.yml:6-7` | `POSTGRES_PASSWORD=pulse` hardcoded; fine for dev but needs env var for staging/prod |
| W3 | `server/src/db/schema.ts:155-160` | projects.organizationId denormalized without documented reason; can drift from workspace.organizationId |
| W4 | `server/src/features/workflows/workflow.processor.ts:98` | `data: result.output ?? {}` — loses legitimate null outputs; should allow null |
| W5 | `server/src/shared/prompt/prompt.service.ts` | Cache uses FIFO eviction; not true LRU (acceptable for MVP) |
| W6 | `server/src/agents/agent.registry.ts:41-51` | Silent agent load failures; no startup health check |
| W7 | `server/src/features/workflows/workflow.service.ts:65` | `getRun()` eagerly loads ALL artifacts + approvals without pagination |
| W8 | `frontend/src/features/workflow/components/artifact-panel.tsx` | 215+ lines — exceeds 150-line limit |
| W9 | All integration services | No retry logic; single failure = permanent step failure |
| W10 | `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/workflows/page.tsx:19` | `.catch(() => {})` swallows errors silently; user sees empty state not error |
| W11 | `server/src/shared/health/health.controller.ts` | Health check doesn't verify DB/Redis connectivity |
| W12 | `frontend/src/features/workflow/components/workflow-shell.tsx:86-93` | Approval handlers catch errors silently; no user feedback |

---

## P3 — Info (Tech Debt / Nice-to-Have)

| # | Area | Description |
|---|------|-------------|
| I1 | TypeScript | Server `tsconfig.json` missing `"strict": true` |
| I2 | Frontend | No React Error Boundary in dashboard layout |
| I3 | Accessibility | Step rail status dots + loading spinners lack ARIA labels |
| I4 | Accessibility | Reasoning/ToolCall panels missing `aria-expanded` |
| I5 | Observability | No request correlation IDs for distributed tracing |
| I6 | Observability | No structured audit logging for credit/org operations |
| I7 | Testing | No seed data for workflow scenarios |
| I8 | Frontend | `progress-bar.tsx` calls `Date.now()` every render (negligible but could memoize) |
| I9 | Documentation | `.env.example` has no descriptions for each variable |

---

## Dependency / Architecture Audit

### ✅ Module Boundaries — Correct
- `AgentsModule` is `@Global()` — correctly available to `WorkflowsModule` without explicit import
- `AuthModule` is `@Global()` — guards available everywhere
- `DatabaseModule` is `@Global()` — single DB instance shared
- No circular dependencies detected

### ✅ Type Safety — Adequate
- `tsc --noEmit` passes clean for both server and frontend
- Schema types flow correctly from Drizzle → services → controllers

### ⚠️ Security Architecture — Partial
- JWT verification: ✅ Correct (Clerk JWKS)
- WebSocket auth: ✅ Correct (JWT + org verification)
- REST auth: ⚠️ Guard validates org context but resource-level access control is broken (P0-3)
- CORS: ✅ Correctly restricted to frontend URL
- Webhook verification: ⚠️ Signature checked but no replay protection
- Secrets in code: ⚠️ Dev-only defaults acceptable; prod deployment needs env enforcement

### ⚠️ Data Flow — Has Gaps
```
Frontend (no auth token) ──✗──→ Backend (guards work but never triggered)
                                      ↓
                              Workflow Engine (race condition on enqueue)
                                      ↓
                              Agent Runtime (no tools registered)
                                      ↓
                              Integration Services (no retry)
```

---

## Recommended Fix Priority

### Sprint 1 (Blockers — must fix for any demo/testing)
1. **P0-1**: Add Clerk token to `apiFetch()`
2. **P0-2**: Create tool registration bootstrap
3. **P0-3**: Fix authorization on `:id` routes
4. **P0-4**: Increment `creditsUsed` with SQL expression
5. **P0-5**: Pass real `organizationId` in workflow runs page
6. **P0-6**: Fix `useCallback` dependency in workflow-shell

### Sprint 2 (Critical — before any real user testing)
7. **P1-1**: Add BullMQ job deduplication
8. **P1-2**: Create DTO classes for all endpoints
9. **P1-3**: Wire up OutputValidator
10. **P1-4**: Add BullMQ retry config
11. **P1-7**: Wrap credit+artifact in transaction

### Sprint 3 (Hardening — before staging)
12. **P1-5**: Add env validation schema
13. **P1-6**: Webhook replay protection
14. **P1-8**: Input sanitization on domain field
15. **W9**: Add retry logic to integration services
16. **W11**: Health check with DB/Redis liveness

---

## Files Audited (39 total)

**Server (26 files)**:
`main.ts`, `app.module.ts`, `db/schema.ts`, `db/index.ts`, `database.module.ts`, `database.service.ts`, `prompt.module.ts`, `prompt.service.ts`, `health.module.ts`, `health.controller.ts`, `auth.module.ts`, `auth.service.ts`, `auth.controller.ts`, `clerk.guard.ts`, `org-membership.guard.ts`, `organizations.controller.ts`, `organizations.service.ts`, `credits.controller.ts`, `credits.service.ts`, `workspaces.controller.ts`, `workspaces.service.ts`, `projects.controller.ts`, `projects.service.ts`, `workflow.service.ts`, `workflow.processor.ts`, `workflow.gateway.ts`, `workflows.module.ts`, `agent.runtime.ts`, `tool.registry.ts`, `tool.sandbox.ts`, `agent.registry.ts`, `output.validator.ts`, `agents.module.ts`, all 7 integration services

**Frontend (13 files)**:
`layout.tsx`, `(dashboard)/layout.tsx`, `workspaces/page.tsx`, `projects/page.tsx`, `workflows/page.tsx`, `workflows/[runId]/page.tsx`, `api.ts`, `middleware.ts`, all 7 workflow feature components + 2 renderers + types + service

**Infrastructure (1 file)**: `docker-compose.yml`
