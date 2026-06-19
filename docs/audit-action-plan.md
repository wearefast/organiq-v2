# Audit Action Plan — Pulse OS

**Source**: CTO-Level Forensic Audit, 2026-06-20  
**Status**: Not started  
**Owner**: Engineering  
**Priority**: Items within each track are ordered highest-risk-first

> This plan translates every finding from the forensic audit into concrete, file-level tasks.
> Work through Track 1 before touching any other track — it contains the only hard security
> items that must not wait.

---

## Track 1 — Security & Hygiene (Do First, No Exceptions)

### TASK-001 · Delete `test-engines.js` from git history and rotate all API keys

**Why**: `server/test-engines.js` is tracked by git and loads `.env` at runtime.
Confirmed via `git grep HEAD`. Anyone with repo access can see which key
variable names are loaded and deduce their values from the `.env` file if it
was ever accidentally committed (even momentarily).

**Steps**:

1. Delete the file from the working tree:
   ```
   Remove-Item server\test-engines.js
   ```
2. Remove from git history (BFG or `git filter-repo`):
   ```
   # Option A — BFG (safer)
   bfg --delete-files test-engines.js
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push origin --force --all

   # Option B — git filter-repo
   git filter-repo --invert-paths --path server/test-engines.js
   git push origin --force --all
   ```
3. Rotate every key currently in `server/.env`:
   - `OPENAI_API_KEY` — OpenAI dashboard → regenerate
   - `ANTHROPIC_API_KEY` — Anthropic console → regenerate
   - `AHREFS_API_KEY` — Ahrefs account → regenerate
   - `SERPER_API_KEY` — Serper dashboard → regenerate
   - `FIRECRAWL_API_KEY` — Firecrawl dashboard → regenerate
   - `PAGESPEED_API_KEY` — GCP console → regenerate
   - `PERPLEXITY_API_KEY` — Perplexity console → regenerate
   - `GEMINI_API_KEY` — GCP console → regenerate
   - `RESEND_API_KEY` — Resend dashboard → regenerate
4. Update `.env` on the EC2 server with new keys:
   ```
   # SSH, edit /home/ec2-user/.env or docker env file, restart container
   ```
5. Verify the file is gone from HEAD after force-push:
   ```
   git grep "test-engines" HEAD
   ```

**Files**: `server/test-engines.js`  
**Validation**: `git grep "OPENAI_KEY\|ANTHROPIC_KEY\|PERPLEXITY_KEY" HEAD` returns no matches

---

### TASK-002 · Delete all root-level debug scripts

**Why**: 10 files at `server/*.js` and 2 at `server/scripts/*.js` contain
hardcoded `postgresql://pulse:pulse@localhost:5433/pulse_v2` credentials. Several
contain production workflow run UUIDs. They serve no runtime purpose.

**Delete these files**:
```
server/chk.js
server/chk2.js
server/check-artifact-sizes.js
server/check-intel.js
server/check-pipeline-data.js
server/check-reasoning.js
server/diag-checkprompt.js
server/diag-rerun.js
server/verify-m03.js
server/scripts/check-context.js
server/scripts/create-test-run.js
```

**Keep**: `server/scripts/delete-run.js` only if it's referenced by a deployment script — otherwise delete it too.

**Steps**:
```powershell
Remove-Item server\chk.js, server\chk2.js, server\check-artifact-sizes.js,
  server\check-intel.js, server\check-pipeline-data.js, server\check-reasoning.js,
  server\diag-checkprompt.js, server\diag-rerun.js, server\verify-m03.js
Remove-Item server\scripts\check-context.js, server\scripts\create-test-run.js
git add -A
git commit -m "Cleanup: delete all one-off debug scripts from server root"
```

**Files**: All files listed above  
**Validation**: `Get-ChildItem server\*.js` returns empty or only intentional files

---

### TASK-003 · Delete repo junk files

**Why**: Binary garbage (`=`), captured log files (`.txt`), and Lighthouse temp
directories should never be in a repository.

**Delete these**:
```
server/=
server/live.log
server/server-diag.txt
server/server-diag-err.txt
server/server-err.txt
server/server-out.txt
server/server-live.txt
server/.lh-tmp/           (directory + contents)
server/.lighthouse-tmp/   (directory + contents)
```

**Steps**:
```powershell
Remove-Item "server/=" -Force
Remove-Item server\live.log, server\server-diag.txt, server\server-diag-err.txt,
  server\server-err.txt, server\server-out.txt, server\server-live.txt
Remove-Item -Recurse -Force server\.lh-tmp, server\.lighthouse-tmp
```

Add to `.gitignore` to prevent re-creation:
```
server/*.log
server/server-*.txt
server/live.log
server/.lh-tmp/
server/.lighthouse-tmp/
```

**Validation**: `git status` is clean after add + commit

---

### TASK-004 · Fix Slack SSRF partial-match validation

**Why**: `webhookUrl.startsWith('https://hooks.slack.com/')` can be bypassed by
a URL like `https://hooks.slack.com.attacker.com/path`. Use hostname comparison
instead.

**File**: `server/src/features/scheduled-workflows/delivery.service.ts`  
**Change** (line ~39):

```typescript
// BEFORE
if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
  throw new Error('Invalid Slack webhook URL');
}

// AFTER
let parsedWebhook: URL;
try {
  parsedWebhook = new URL(webhookUrl);
} catch {
  throw new Error('Invalid Slack webhook URL');
}
if (parsedWebhook.protocol !== 'https:' || parsedWebhook.hostname !== 'hooks.slack.com') {
  throw new Error('Invalid Slack webhook URL');
}
```

**Validation**: Unit test with `https://hooks.slack.com.evil.com/x` — must throw

---

### TASK-005 · Enforce required API keys at startup

**Why**: `ANTHROPIC_API_KEY`, `AHREFS_API_KEY`, `SERPER_API_KEY`,
`FIRECRAWL_API_KEY` are marked `@IsOptional()` in `env.validation.ts`. The server
boots successfully without them, then crashes 30 minutes into a workflow step with
a cryptic "undefined key" error. These must be required.

**File**: `server/src/shared/config/env.validation.ts`

**Change**: Remove `@IsOptional()` from the following fields:
```typescript
// Remove @IsOptional() from each of these:
ANTHROPIC_API_KEY: string;
AHREFS_API_KEY: string;
SERPER_API_KEY: string;
FIRECRAWL_API_KEY: string;
DATAFORSEO_LOGIN: string;
DATAFORSEO_PASSWORD: string;
```

Keep `@IsOptional()` only for:
- `PAGESPEED_API_KEY` (graceful degradation acceptable)
- `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` (prompt-visibility extras)
- `STRIPE_*` (billing optional for dev)
- `SENDGRID_API_KEY`, `RESEND_API_KEY` (delivery optional for dev)

**Validation**: Remove `ANTHROPIC_API_KEY` from `.env`, run `npm run dev:server` — server
must refuse to start with a clear validation error

---

## Track 2 — Critical Code Correctness

### TASK-006 · Remove duplicate `StepJobData` interface

**Why**: Declared twice consecutively in `workflow.processor.ts` at lines 27–35.
TypeScript silently merges the declarations but it's confusing and will drift.

**File**: `server/src/features/workflows/workflow.processor.ts`

**Change**: Delete the second identical `interface StepJobData { ... }` block (the one at lines 32–36).

**Validation**: `npx tsc --noEmit` passes in `server/`

---

### TASK-007 · Make `business-profile` credit debit transaction-bound

**Why**: `business-profile.service.ts` wraps the credit debit in a `try-catch` with
only a `logger.warn` on failure. If the debit fails, the analysis is persisted but
the org is not charged — silent revenue loss.

**File**: `server/src/features/projects/business-profile.service.ts`

**Change**: Move the `creditsService.debit()` call into the same Drizzle transaction
as the `projects` update. Pattern to follow: `workflow.processor.ts` lines 627–636
(debit inside `db.transaction(async (tx) => { ... })`).

```typescript
// BEFORE (lines ~430)
await this.db.db
  .update(projects)
  .set({ businessProfile: ..., updatedAt: new Date() })
  ...
// separate try-catch debit

// AFTER — single transaction
const [updated] = await this.db.db.transaction(async (tx) => {
  const [row] = await tx
    .update(projects)
    .set({ businessProfile: profileWithCompetitors, ... })
    .where(...)
    .returning();

  await this.creditsService.debit({
    organizationId,
    amount: BUSINESS_PROFILE_CREDIT_COST,
    description: 'Business Profile analysis',
  }, tx);

  return [row];
});
```

**Validation**: `tsc --noEmit` passes; manually test that a failed debit rolls back the profile update

---

### TASK-008 · Wire `PlanLimitGuard` or delete it

**Why**: `PlanLimitGuard` and the `@PlanLimit()` decorator are complete, tested
implementations but no controller applies them. Plan limits are unenforced in
production — a starter-plan org can create unlimited projects and run unlimited
workflows.

**Decision needed first**: Is plan enforcement intentional deferred? If yes, document
in `docs/decisions/`. If no, apply the guard.

**Apply to** (if enforcing):

1. `ProjectsController.create()` — add `@UseGuards(PlanLimitGuard) @PlanLimit('projects')`
2. `WorkflowController.startRun()` — add `@UseGuards(PlanLimitGuard) @PlanLimit('workflowsPerMonth')`
3. `OnDemandAgentsController.run()` — add `@UseGuards(PlanLimitGuard) @PlanLimit('agentRunsPerMonth')`

**Files**:
- `server/src/features/projects/projects.controller.ts`
- `server/src/features/workflows/workflow.controller.ts`
- `server/src/features/on-demand-agents/on-demand-agents.controller.ts`

**Validation**: Create a starter-plan org, create 2 projects (second should 403), create 6 workflow runs (6th should 403)

---

### TASK-009 · Fix `(this.workflowQueue as any)` type-unsafe casts

**Why**: Two `as any` casts reach into BullMQ internals:
- `workflow.service.ts:487` — `(this.workflowQueue as any).client`
- `workflow-queue-listener.service.ts:20` — `(this.queue as any).opts?.connection`

These will break silently on BullMQ upgrades.

**Files**:
- `server/src/features/workflows/workflow.service.ts`
- `server/src/features/workflows/workflow-queue-listener.service.ts`

**Fix for `workflow.service.ts`** — inject `IORedis` directly instead of extracting from queue:
```typescript
// In constructor, inject IORedis alongside the queue
constructor(
  ...
  @InjectQueue('workflow-steps') private readonly workflowQueue: Queue,
  @InjectRedis() private readonly redis: Redis, // add this
) {}

// Replace the (this.workflowQueue as any).client usage with this.redis
```

**Fix for `workflow-queue-listener.service.ts`** — use the BullMQ public `QueueEvents` constructor with explicit connection config from `ConfigService` instead of extracting from queue internals.

**Validation**: `tsc --noEmit` passes with strict mode

---

## Track 3 — Architecture: Eliminate Duplicate API Client Calls

The following items eliminate raw `fetch()` bypasses of the service layer.
Each is independent — they can be done in any order.

---

### TASK-010 · Move `discoverCompetitors` OpenAI call into `OpenAiService`

**Why**: `business-profile.service.ts:discoverCompetitors()` calls
`fetch('https://api.openai.com/v1/chat/completions', ...)` directly.
This bypasses retry logic, has no error wrapping, and passes the API key as a
plain string parameter.

**File**: `server/src/features/projects/business-profile.service.ts`

**Change**:
1. Replace the raw `fetch` block in `discoverCompetitors()` with a call to
   `this.openai.chatCompletion(...)` (the injected `OpenAiService`).
2. Remove the `apiKey` parameter from `discoverCompetitors()` — the service
   holds the key internally.
3. Remove `apiKey` from the call site.

**Validation**: `tsc --noEmit` passes; business profile analysis still produces competitors

---

### TASK-011 · Move `aiExtractPosition` OpenAI call into `OpenAiService`

**Why**: `prompt-visibility.service.ts:aiExtractPosition()` also calls
`fetch('https://api.openai.com/v1/chat/completions', ...)` directly, passing
`apiKey` as a parameter.

**File**: `server/src/features/prompt-visibility/prompt-visibility.service.ts`

**Change**: Same pattern as TASK-010. Replace raw fetch with `this.openai.chatCompletion()`.
Remove `apiKey` parameter.

**Validation**: `tsc --noEmit`; prompt visibility checks still produce position data

---

### TASK-012 · Rewrite `engine-query.service.ts` to use injected services

**Why**: This is the worst offender — 5 raw `fetch()` calls to 5 different AI
providers with no retry, no timeout, and no structured error handling.

**File**: `server/src/features/prompt-visibility/engine-query.service.ts`

**Change**:
1. Inject `AnthropicService` — replace `queryClaude()` raw fetch with SDK call
2. Inject `OpenAiService` — replace `queryOpenAI()` raw fetch with service call
3. Leave Perplexity, Gemini, Bing as raw fetch for now (no existing service) but:
   - Add a 30-second timeout via `AbortSignal.timeout(30_000)`
   - Add try-catch with structured error logging
   - Add a single exponential-backoff retry on 429/500

**Validation**: `tsc --noEmit`; prompt visibility check runs against all 5 engines

---

### TASK-013 · Extract shared `ClerkJwtVerifier` utility

**Why**: JWKS resolution + JWT verification logic is copy-pasted between
`ClerkGuard` (HTTP) and `WorkflowGateway` (WebSocket). They each maintain
independent JWKS caches. One change to the verification logic must be applied in
two places.

**Files**:
- `server/src/features/auth/clerk.guard.ts`
- `server/src/features/workflows/workflow.gateway.ts`

**Change**:
1. Create `server/src/features/auth/clerk-jwt-verifier.ts` — extract `getJwks()`,
   `resolveIssuer()`, and `normalizeDomain()` into a `@Injectable()` service.
2. Export from `AuthModule`.
3. Update `ClerkGuard` and `WorkflowGateway` to inject `ClerkJwtVerifier` and
   delete their local implementations.

**Validation**: `tsc --noEmit`; WebSocket connection still authenticates; HTTP endpoints still authenticate

---

## Track 4 — Architecture: Concurrency & Rate Limiting

### TASK-014 · Add concurrency semaphore to Firecrawl batch scrape

**Why**: `business-profile.service.ts` fires up to 40 concurrent Firecrawl
requests via `Promise.all()`. This saturates the Firecrawl rate limit instantly and
causes unpredictable failures.

**File**: `server/src/features/projects/business-profile.service.ts`

**Change**: Replace `Promise.all(cappedPages.map(...))` with a concurrency-limited
runner (max 10 concurrent):

```typescript
// Simple semaphore implementation inline (no new dependency needed)
async function withConcurrency<T>(
  items: string[],
  limit: number,
  fn: (item: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).then((r) => { results.push(r); }).finally(() => executing.delete(p as any));
    executing.add(p as any);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

// Usage: replace Promise.all(...) with:
const scrapedPages = await withConcurrency(cappedPages, 10, async (url) => {
  try {
    const content = await this.firecrawl.scrape(url);
    return { url, data: content };
  } catch (err) {
    this.logger.warn(`Firecrawl scrape failed for ${url}: ${(err as Error).message}`);
    return { url, data: null };
  }
});
```

**Validation**: Business profile still works; Firecrawl rate limit errors reduced

---

### TASK-015 · Add startup warning when `SUPER_ADMIN_CLERK_IDS` is not configured

**Why**: If `SUPER_ADMIN_CLERK_IDS` is empty, internal admin endpoints silently
403. There is no startup log warning operators. The first indication is a 403 in
production.

**File**: `server/src/features/internal/super-admin.guard.ts` or
`server/src/features/internal/internal.module.ts`

**Change**: Add an `OnModuleInit` hook in `InternalModule` or inject a startup
check in `SuperAdminGuard`:

```typescript
// In InternalModule
export class InternalModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}
  onModuleInit() {
    const ids = this.config.get<string>('SUPER_ADMIN_CLERK_IDS', '');
    if (!ids.trim()) {
      console.warn('[InternalModule] WARNING: SUPER_ADMIN_CLERK_IDS is not set — internal admin endpoints are inaccessible');
    }
  }
}
```

**Validation**: Start server without `SUPER_ADMIN_CLERK_IDS` — warning appears in logs

---

## Track 5 — File Size & Maintainability

These items are lower urgency but block safe onboarding of new engineers and
increase the blast radius of every future change.

---

### TASK-016 · Split `workflow.processor.ts` (784 lines) into focused files

**Why**: The processor is a 784-line god-class. It contains three unrelated
execution paths (pipeline-only, pipeline-then-agent, agent-with-tools), complex
context transformation logic, DLQ handling, and run failure propagation.

**Target structure**:

```
server/src/features/workflows/
  workflow.processor.ts        (thin coordinator, ≤150 lines)
  execution/
    pipeline-executor.ts       (pipeline-only + pipeline-then-agent paths)
    agent-executor.ts          (agent-only + agent-with-tools paths)
    step-persister.ts          (DB transaction: artifact + credits + status update)
    context-transformer.ts    (transformContextForStep + extractCompetitorBrands)
    run-failure-handler.ts     (DLQ capture + run failure propagation)
```

**Approach**: Extract one file at a time, starting with `context-transformer.ts`
(pure function, no DI, easiest to test in isolation).

**Validation**: `tsc --noEmit` + all existing spec tests pass after each extraction

---

### TASK-017 · Split `llm-audit.service.ts` (1,103 lines) into sub-services

**Why**: Contains unrelated concerns: robots.txt parsing, sitemap analysis,
HTML content checks, Lighthouse integration, trust signal checks, citation
readiness analysis, and audit result persistence.

**Target structure**:

```
server/src/features/audit/
  llm-audit.service.ts          (orchestrator, ≤200 lines)
  sub-services/
    robots-parser.service.ts    (robots.txt + llms.txt parsing)
    content-checker.service.ts  (HTML content checks, semantic structure)
    trust-signals.service.ts    (schema, OG tags, E-E-A-T signals)
    lighthouse.service.ts       (PageSpeed/Lighthouse wrapper)
    sitemap-analyzer.service.ts (sitemap + lastmod analysis)
```

**Note on Lighthouse**: Before splitting, evaluate whether `lighthouse` +
`chrome-launcher` should be replaced with `PageSpeedService.analyze()` entirely.
Spawning Chrome in-process on a `t3.small` will OOM the container. See TASK-020.

**Validation**: `tsc --noEmit` + LLM audit returns same shape after refactor

---

### TASK-018 · Split `verdict-strategy.tsx` and `business-profile.tsx`

**Why**: These frontend artifact renderer components are 1,164 and 1,012 lines
respectively — 7–8× over the declared 150-line limit. They are impossible to test
and expensive to re-render.

**`verdict-strategy.tsx` target sub-components**:
```
renderers/
  verdict-strategy/
    index.tsx                     (coordinator)
    strategy-summary.tsx
    keyword-opportunities.tsx
    competitive-positioning.tsx
    content-strategy-section.tsx
    quick-wins-table.tsx
```

**`business-profile.tsx` target sub-components**:
```
renderers/
  business-profile/
    index.tsx
    profile-header.tsx
    competitor-grid.tsx
    audience-targeting.tsx
    positioning-statement.tsx
```

**Approach**: Move sections bottom-up. Identify the lowest section (fewest
dependencies), extract it, verify render, move to next.

**Validation**: `tsc --noEmit` (frontend); visual inspection that rendered output is identical

---

### TASK-019 · Document the three-tier execution system

**Why**: The relationship between `agents/definitions/*.agent.md`,
`features/workflows/pipelines/*.pipeline.ts`, and `src/skills/*/skill.md` is
undocumented. Any new engineer will spend days reverse-engineering it.

**Create**: `server/src/agents/EXECUTION_TIERS.md`

**Content must explain**:
1. What each tier is and when to use it:
   - `pipeline-only`: deterministic data fetch, no LLM (pipeline class required)
   - `pipeline-then-agent`: fetch data first, then LLM reasons over it (pipeline + agent.md)
   - `agent-only`: LLM reasons over workflow context only, no tools (agent.md only)
   - `agent-with-tools`: LLM uses tools autonomously (agent.md + tool definitions)
2. What `skill.md` files are and how `SkillService` injects them into prompts
3. The relationship between `agent.md` and prompt `.md` files in `prompts/`
4. Decision flow: how `WorkflowProcessor` picks the execution path
5. How to add a new step (end-to-end example)

**Validation**: Another engineer can add a new `pipeline-only` step without asking questions

---

## Track 6 — Dead Code Removal

### TASK-020 · Evaluate and remove dead `analytics` frontend feature

**Why**: `frontend/src/features/analytics/` contains only `hooks/` and `services/`
with no UI components. There are no routes that render analytics UI.

**Steps**:
1. `grep -r "analytics" frontend/src/app/` — identify any route pages that import from this feature
2. If no routes reference it: delete `frontend/src/features/analytics/`
3. If routes reference it: create stub components and mark with `// TODO: Analytics UI`

**Validation**: `npx tsc --noEmit` (frontend) passes after deletion

---

### TASK-021 · Evaluate `AccessGuard` / `access_grants` system

**Why**: `AccessGuard`, `AccessService`, and the `accessGrants` + `accessGrantTypeEnum`
table schema exist but no controller applies `@UseGuards(AccessGuard)`.
This is a complete implementation of granular resource-level permissions that
appears to be unused.

**Steps**:
1. Run: `grep -r "AccessGuard\|ResourceAccess\|access_grants" server/src/features/`
2. If zero controller usages found: add `// @experimental — not yet applied to any routes`
   comment block to `access.guard.ts` OR delete if confirmed pre-mature abstraction
3. If usages found: document which routes use it

**Validation**: Decision recorded in `docs/decisions/`

---

### TASK-022 · Audit and clean `openai` npm package usage

**Why**: `openai` SDK (^6.35.0) is a server dependency but `OpenAiService` uses raw
`fetch()` for all calls. The SDK may only be used for type imports. If so, it adds
~500KB to the production bundle for no runtime benefit.

**Steps**:
```powershell
# Find all imports of the openai package
grep -r "from 'openai'" server/src/
grep -r "require('openai')" server/src/
```

1. If only type imports (`import type { ... } from 'openai'`): move to `devDependencies`
2. If zero imports: remove from `package.json` entirely
3. If runtime imports exist: document which services use the SDK vs raw fetch

**Validation**: `npm run build` passes after removal

---

## Track 7 — Reliability & Scalability

### TASK-023 · Replace in-process Lighthouse with `PageSpeedService` call

**Why**: `llm-audit.service.ts` uses `chrome-launcher` + `lighthouse` to run
Lighthouse in-process. On `t3.small` (2 vCPU, 2 GB RAM), spawning headless Chrome
will consume available memory and crash the NestJS container under concurrent audit
load.

**File**: `server/src/features/audit/llm-audit.service.ts`

**Change**:
1. Find all calls to `lighthouse(url, ...)` in the service
2. Replace with `this.pageSpeedService.analyze(url, 'mobile')` + `this.pageSpeedService.analyze(url, 'desktop')`
3. Map the `PageSpeedService` result shape to the same local interface used by audit consumers
4. Remove `lighthouse` and `chrome-launcher` from `server/package.json` dependencies

**Validation**: LLM audit still returns performance scores; `t3.small` no longer spawns Chrome

---

### TASK-024 · Add Redis lock telemetry to `enqueuePendingSteps`

**Why**: The Redis distributed lock in `enqueuePendingSteps` uses `(this.workflowQueue as any).client`
to get a Redis client (the `as any` cast in TASK-009). Once TASK-009 resolves the
injection, add structured logging for lock acquisition failures so we can observe
contention in production.

**File**: `server/src/features/workflows/workflow.service.ts`

**Change**: After the injected `Redis` client is available (post TASK-009), add:
```typescript
// Log when lock is NOT acquired (concurrent enqueue skipped)
if (!acquired) {
  this.logger.debug(`enqueuePendingSteps: lock contention on run ${workflowRunId} — skipped (another worker holds lock)`);
}
```

**Validation**: Log appears in dev when two steps complete simultaneously

---

## Track 8 — Documentation

### TASK-025 · Add `SUPER_ADMIN_CLERK_IDS` and missing keys to `.env.example`

**Why**: `server/.env` exists but is gitignored. New engineers have no reference
for what variables are needed. `SUPER_ADMIN_CLERK_IDS`, `PERPLEXITY_API_KEY`,
`GEMINI_API_KEY`, and `BING_SEARCH_API_KEY` are used in code but not documented.

**File**: `server/.env.example` (create if not present, update if present)

**Content**: Every variable from `env.validation.ts` + every `config.get()` call
not already in validation, with placeholder values and a one-line comment.

---

### TASK-026 · Add `docs/decisions/` record for `business-profile` outside the DAG

**Why**: `business-profile` has an `.agent.md` definition, a `.pipeline.ts`, and a
`business-profile.service.ts` — but it is NOT in `STEP_DEFINITIONS` and runs on
demand from the project overview, not from the workflow queue. This is confusing
without documentation.

**Create**: `docs/decisions/business-profile-execution-model.md`

**Content**:
- Why it's not a DAG step
- When it runs (on demand + before workflow startRun validation)
- Why the `.agent.md` definition exists (AgentRuntime re-use)
- Credit debit pattern difference from workflow steps

---

## Summary Checklist

| Track | Tasks | Urgency |
|-------|-------|---------|
| Track 1 — Security & Hygiene | TASK-001 to TASK-005 | **Today** |
| Track 2 — Code Correctness | TASK-006 to TASK-009 | This sprint |
| Track 3 — API Client Dedup | TASK-010 to TASK-013 | This sprint |
| Track 4 — Concurrency | TASK-014 to TASK-015 | This sprint |
| Track 5 — File Size | TASK-016 to TASK-019 | Next sprint |
| Track 6 — Dead Code | TASK-020 to TASK-022 | Next sprint |
| Track 7 — Reliability | TASK-023 to TASK-024 | Next sprint |
| Track 8 — Documentation | TASK-025 to TASK-026 | Ongoing |

**Total tasks**: 26  
**Blockers between tasks**:
- TASK-009 must complete before TASK-024
- TASK-017 should assess TASK-023 (Lighthouse) before splitting the service
- TASK-019 (documentation) can be done in parallel with any Track 5 item

---

## Definition of Done (for each task)

A task is complete when:
- [ ] Code change is made and `tsc --noEmit` passes in the affected workspace
- [ ] `git commit` message references the task ID (e.g. `Cleanup: TASK-002 delete debug scripts`)
- [ ] No existing tests are broken (run `npm run typecheck` in root)
- [ ] If the task touches an API endpoint, the endpoint is smoke-tested against staging
- [ ] This file is updated: task row marked complete with date
