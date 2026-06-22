# Changelog

All notable changes to the Pulse OS codebase, organized by audit and implementation phases.

---

## [Production Launch — AWS + Vercel] — June 19, 2026

**Pulse OS (Rank Organiq) is live in production.**

### Production URLs

| Surface | URL |
|---------|-----|
| Frontend | https://app.rankorganiq.com |
| Backend API | https://api.rankorganiq.com |

### Infrastructure

| Layer | Service |
|-------|---------|
| Frontend hosting | Vercel (auto-deploy on `main` push) |
| Backend | EC2 t3.small (`ap-southeast-1`), Docker, nginx, Let's Encrypt SSL |
| Database | RDS PostgreSQL 16 (`pulse-postgres`, private subnet) |
| Cache / Queue | ElastiCache Redis 7 (`pulse-redis`, TLS, private subnet) |
| Container registry | ECR `organiq-server-prod` (`ap-southeast-1`) |

### CI/CD Pipeline

- **Frontend**: Push to `main` → Vercel builds and deploys automatically. No manual steps.
- **Backend**: Push to `main` touching `server/**` → GitHub Actions (`.github/workflows/deploy.yml`) → build Docker image → push to ECR → SSH to EC2 → run migrations → hot-swap container (~1-2s downtime).

---

## [Security Hardening Phase 1 + Phase 2] — June 19–22, 2026

**Comprehensive security audit (score 5.4/10) with two-phase hardening. See `docs/audit-action-plan.md` for full findings.**

### Phase 1 — Auth/AuthZ Overhaul

| File | Change |
|------|--------|
| `server/src/features/auth/access.guard.ts` | New: `AccessGuard` — granular resource-level guard using `access_grants` table |
| `server/src/features/auth/access.service.ts` | New: `AccessService` — resolves grants for org/workspace/project resources |
| `server/src/features/auth/admin-only.guard.ts` | New: `AdminOnlyGuard` — restricts to `admin` or `owner` roles |
| `server/src/features/auth/decorators/` | New: `@ResourceAccess('workspace'|'project'|'org')` decorator |
| `server/src/features/auth/auth.controller.ts` | Webhook verification now uses `timingSafeEqual` (constant-time); in-memory replay prevention (5-min TTL, 10-min cleanup) |
| `server/src/features/auth/auth.service.ts` | idempotent org/member upserts preserved |

### Phase 2 — HTTP Hardening

| File | Change |
|------|--------|
| `server/src/main.ts` | Helmet installed: `frameguard: DENY`, CSP disabled (API-only server) |
| `server/src/main.ts` | CORS origin tightened: only `FRONTEND_URL` + `localhost:3001` allowed |
| `server/package.json` | Added `helmet` dependency |

---

## [User Management + Team Features] — June 19–22, 2026

**New `user-management` module adds full team management: members, invitations, access grants, workspace credit limits.**

### New API Endpoints (`server/src/features/user-management/`)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `orgs/:orgId/members` | List members with access grants (admin only) |
| `DELETE` | `orgs/:orgId/members/:memberId` | Remove member (admin only) |
| `PUT` | `orgs/:orgId/members/:memberId/access` | Replace member access grants (admin only) |
| `GET` | `orgs/:orgId/members/me/access` | Get own access grants |
| `GET` | `orgs/:orgId/invitations` | List pending invitations (admin only) |
| `POST` | `orgs/:orgId/invitations` | Create + email invitation (admin only, throttled 10/60s) |
| `DELETE` | `orgs/:orgId/invitations/:invitationId` | Revoke invitation (admin only) |
| `GET` | `orgs/:orgId/workspaces/:workspaceId/credit-limit` | Get workspace monthly credit cap |
| `PUT` | `orgs/:orgId/workspaces/:workspaceId/credit-limit` | Set workspace monthly credit cap |
| `DELETE` | `orgs/:orgId/workspaces/:workspaceId/credit-limit` | Remove monthly cap |
| `GET` | `invitations/:token` | Preview invitation (public) |
| `POST` | `invitations/:token/accept` | Accept invitation (requires Clerk auth) |

### New Database Tables (migrations 0021–0023)

- `invitations` — Email invitations with `crypto.randomUUID()` token, 7-day expiry, `clerk_invitation_id`
- `access_grants` — Discriminated-union grants (`org`/`workspace`/`project` scope) per member
- `workspace_credit_limits` — Monthly credit cap per workspace with usage tracking + monthly reset cron
- `org_role` enum — Added `'user'` value; renamed `'member'` → `'user'`

### Frontend (`/settings/members`)

New page at `/settings/members` (admin only). Features: members table with access editor modal, invitations table, workspace credit limits section. Non-admins redirected to `/settings`.

---

## [Internal Admin API] — June 19–22, 2026

**New `internal` module for super-admin operations. Protected by `SUPER_ADMIN_CLERK_IDS` env var.**

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `internal/orgs/:orgId/credits` | Add credits to an org (audited) |
| `GET` | `internal/orgs/:orgId/credits` | Get balance + last 20 ledger entries |
| `GET` | `internal/orgs` | List all orgs (cap 500) |
| `GET` | `internal/orgs/:orgId` | Get single org detail |

Frontend: `/admin` page (super-admin only).

---

## [Forum Intelligence Feature] — June 19–22, 2026

**New content sub-feature: AI-driven forum/community content opportunity discovery.**

| File | Purpose |
|------|---------|
| `server/src/features/content/forum-intelligence.service.ts` | DataForSEO Reddit SERP + AI analysis |
| `server/src/features/content/forum-intelligence.processor.ts` | BullMQ processor |
| `frontend/src/app/(dashboard)/.../content/forums/page.tsx` | Forum intelligence page |

- Searches Reddit via DataForSEO `searchRedditThreads`; surfaces content opportunities from community discussions
- Accessible via side nav under Content → Forums
- New DB tables: `forum_topics`, `forum_opportunities` (migration 0019)

---

## [New Database Migrations (0016–0023)] — June 2026

| Migration | Change |
|-----------|--------|
| `0016_project_business_profile.sql` | `business_profile jsonb` + `business_profile_updated_at` on `projects` |
| `0017_project_intelligence.sql` | Project intelligence fields on `projects` |
| `0018_prompt_visibility_response_text.sql` | Response text column on prompt visibility results |
| `0019_forum_intelligence.sql` | `forum_topics` + `forum_opportunities` tables |
| `0020_project_assets.sql` | `project_assets` table |
| `0021_user_management.sql` | New enums: `invitation_status`, `access_grant_type`; added `'user'` to `org_role` |
| `0022_user_management_tables.sql` | `invitations`, `access_grants`, `workspace_credit_limits`; `workspace_id` on `credit_ledger` |
| `0023_clerk_invitation_id.sql` | `clerk_invitation_id` on `invitations` |

---

## [Prompt Visibility — Engine Overhaul] — June 2026

**All 5 LLM engines now use web-search-capable models. Majority vote (3× per engine).**

| Engine | Model |
|--------|-------|
| Perplexity | `sonar` (`api.perplexity.ai`) |
| OpenAI | `gpt-4o-mini-search-preview` |
| Gemini | `gemini-1.5-flash` with `google_search_retrieval` tool |
| Claude | `claude-sonnet-4-6` with `web_search_20250305` beta |
| Copilot | Bing Web Search v7 (`api.bing.microsoft.com`) |

New required env vars: `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `BING_SEARCH_API_KEY`.

---

## [UX Features — Help, Tour, Step Phases] — June 2026

### Help System
- Static help docs at `/help` with search, sidebar, and article views
- `frontend/src/features/help/`

### Guided Tour (Driver.js)
- Auto-starts for new users with 0 workspaces
- Tracked in `localStorage` (`pulse_tour_active`, `pulse_tour_completed_sections`, `pulse_tour_dismissed`)
- Restartable from top bar
- `frontend/src/features/tour/`

### Workflow Step Phases + Estimated Durations
- Each pipeline step now emits named sub-phases (e.g., "Fetching data…", "AI Analyzing…") via WebSocket
- Step cards show real-time phase message during execution
- Agent definitions include `estimatedDurationSec` for UI progress indication

### Step Delete (workflow)
- Users can delete individual workflow runs from the run list

---

## [Ahrefs Partial Restoration — Seed Keywords] — June 2026

The seed-keywords pipeline was updated to use Ahrefs as the primary organic keyword source when DataForSEO Labs returns sparse results for the target domain. DataForSEO remains the primary for competitor discovery, backlinks, volume, and difficulty.

| Pipeline | Change |
|----------|--------|
| `seed-keywords` | Added Ahrefs `getOrganicKeywords` as fallback enrichment path when DFS returns <5 results |

---



**DataForSEO is now the primary SEO data source for all keyword intelligence, competitor discovery, and backlink analysis pipelines. Ahrefs is retained for SERP overview and organic page lookups only.**

### Pipelines Migrated from Ahrefs → DataForSEO

| Pipeline | Before | After |
|----------|--------|-------|
| `business-profile` | Ahrefs `getDomainRating` + `getBacklinksStats` | DataForSEO `getBacklinksSummary` (backlinks, referring_domains, rank) |
| `competitor-buckets` | Ahrefs `getCompetingDomains` | DataForSEO Labs `getCompetitorsDomain` (keyword-overlap based) |
| `competitor-metrics` | Ahrefs `getDomainRating` + `getBacklinksStats` + `getOrganicKeywords` × N | DataForSEO `getBacklinksSummary` + Labs `getRankedKeywords` × N |
| `seed-keywords` | Ahrefs `getOrganicKeywords` + `getRelatedKeywords` | DataForSEO Labs `getRankedKeywords` + `getKeywordSuggestions` |
| `search-demand` | DataForSEO volume + Ahrefs `getKeywordDifficulty` | DataForSEO volume + DataForSEO Labs `getBulkKeywordDifficulty` |

### New DataForSEO Service Methods

| Method | Endpoint | Used By |
|--------|----------|---------|
| `getRankedKeywords(domain, location, language, limit)` | `POST /v3/dataforseo_labs/google/ranked_keywords/live` | `seed-keywords`, `competitor-metrics` |
| `getBulkKeywordDifficulty(keywords[], location, language)` | `POST /v3/dataforseo_labs/google/bulk_keyword_difficulty/live` | `search-demand` |
| `getCompetitorsDomain(domain, location, language, limit)` | `POST /v3/dataforseo_labs/google/competitors_domain/live` | `competitor-buckets` |
| `searchRedditThreads(query, country, depth)` | `POST /v3/serp/google/organic/live/advanced` (site:reddit.com) | Forum intelligence |

### Ahrefs Remaining Role

Ahrefs is retained for:
- **`serp-niche-map` pipeline**: `getSerpOverview` × ≤20 keywords (1.1s rate-limited)
- **`method01-competitor-pages` pipeline**: `getOrganicPages` × N competitors
- **`phase1-baseline` pipeline**: `getOrganicPages` × 1 (organic keywords come from `seed-keywords` context)
- **Agent tools** (on-demand agents may still call any Ahrefs tool via the tool registry)

### Location Normalization

Added `LOCATION_MAP` to `DataForSeoService` resolving ISO country codes and short names (e.g., `us` → `United States`, `ae` → `United Arab Emirates`) for 50+ countries. Eliminates a previous class of DataForSEO 40xxx task errors caused by unrecognized location values.

### Documentation Updated

- `docs/features/integrations.md` — DataForSEO expanded to 13 methods; Ahrefs role narrowed; Tool Registry table updated
- `docs/features/workflows.md` — Pipeline table updated with correct integration sources
- `docs/project-handbook.md` — Tech stack updated (DataForSEO primary, Ahrefs secondary)
- `docs/architecture-map/data.json` — Knowledge graph `pipelineCalls` updated for 5 agents

---

## [R12 — LLM Crawlability Audit, Content Pipeline Refactor, Agent Runtime Consolidation] — June 12, 2026

**Major feature release: standalone LLM crawlability audit, content pipeline enhancements, agent runtime refactoring, and pipeline improvements.**

### LLM Crawlability Audit (Standalone Feature)

Full-featured standalone audit for evaluating how AI search engines can crawl, parse, and trust project web pages.

| File | Purpose |
|------|---------|
| `server/src/features/audit/llm-audit.service.ts` | Crawl orchestration, HTML parsing, score computation |
| `server/src/db/schema.ts` | `llmAuditResults` table definition |
| `frontend/src/app/(dashboard)/.../ai-search/llm-audit/page.tsx` | Full audit dashboard (score banner, sparkline, section grid, bot matrix) |
| `frontend/src/features/analytics/services/llm-audit.service.ts` | Frontend API client |
| `docs/features/llm-crawlability-audit.md` | Complete feature documentation |

Scoring system: 4 categories (bot permissions 20pts, content structure 25pts, trust signals 25pts, content chunking 20pts), hard penalty cap, grade labels, 17 issue types, batch processing (5 URLs), delta badges, sparkline history.

### Content Pipeline Enhancements

| Component | Change |
|-----------|--------|
| `content.controller.ts` | New endpoints for content assets and forum intelligence |
| `forum-intelligence.service.ts` | New service for forum content analysis |
| `forum-intelligence.processor.ts` | BullMQ processor for forum intel |
| `content/assets/page.tsx` | New content assets page |
| `content/forums/page.tsx` | Enhanced forum intelligence page |

### Agent Runtime Refactoring

| File | Change |
|------|--------|
| `server/src/agents/agent.runtime.ts` | Major refactor — 422 lines rewritten for robustness |
| `server/src/agents/agent.runtime.spec.ts` | New test suite (296 lines) |
| `server/src/agents/agents.module.ts` | Module restructure |

### Pipeline Improvements

| Pipeline | Change |
|----------|--------|
| `consolidated-keywords.pipeline.ts` | New pipeline (378 lines) — keyword consolidation |
| `method03-content-gap.pipeline.ts` | Major enhancement (288+ lines) |
| `seed-keywords.pipeline.ts` | Extended (244+ lines) |
| `search-demand.pipeline.ts` | Extended with new data flows |
| `ai-intelligence.pipeline.ts` | Enhanced intelligence gathering |
| `business-profile.pipeline.ts` | Updated profile handling |
| `competitor-metrics.pipeline.ts` | Extended metric collection |

### Prompt Visibility Enhancements

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/.../ai-search/visibility/page.tsx` | Major UI expansion (537+ lines) |
| `frontend/src/features/analytics/services/prompt-visibility.service.ts` | New service methods |

### Frontend Enhancements

- `refresh-suggestions-card.tsx` — New component for content refresh suggestions
- `use-business-profile-ready.ts` — New hook for business profile state
- `project.service.ts` — Extended project API service
- `rich-text.tsx` — New rich text shared component
- Business profile renderer expanded (748+ lines)
- Topical map renderer expanded (507+ lines)
- Search demand renderer expanded (330+ lines)
- Overview page enhanced (276+ lines)
- Start-run component improved with workflow context

### Infrastructure

- `.github/workflows/deploy.yml` — CI/CD deployment workflow added
- `web-crawler.service.ts` — Major expansion (414+ lines) for enhanced crawling
- Multiple integration service enhancements (Anthropic, DataForSEO, OpenAI, Serper)

### Deleted Stale Files

- `script1.js`, `script2.js` — One-off migration scripts
- `server/scripts/add-return-output.ts`, `deploy-agents.ts`, `export-tool-schemas.ts` — Stale managed-agent deployment artifacts
- `frontend/src/shared/hooks/use-keyboard-shortcuts.ts` — Unused
- `docs/debugging/phase-ab-audit.md`, `docs/debugging/phase-abc-audit.md` — Resolved audit snapshots
- `docs/workflow-pipeline-visual.html` — Orphaned visualization

---

## [Documentation & Code Cleanup] — May 30, 2026

**CPTO documentation audit: deleted stale docs, resolved circular deps, removed dead code.**

### Docs: Deleted 5 irrelevant/stale files

| Deleted File | Reason |
|---|---|
| `claude-console-agent-system-prompts.md` | Referenced retired Anthropic managed agents deployment model |
| `architecture/messages-api-architecture.md` | Pre-implementation design doc — migration already complete |
| `workflow-pipeline-visual.html` | Orphaned HTML visualization, not linked from any doc |
| `debugging/phase-ab-audit.md` | Session snapshot (May 11) — all issues resolved |
| `debugging/phase-abc-audit.md` | Session snapshot (May 11) — all showstoppers fixed |

### Docs: Updated 5 files for accuracy

- `implementation-plan.md` — Replaced 6 Python sidecar references with actual NestJS implementations
- `dependencies.md` — Fixed LLM provider: Anthropic Claude is primary (not OpenAI GPT-4o)
- `technical-debt.md` — Marked 4 items resolved (#3, #4, #5, #12); added #16 (deprecated tier fields)
- `roadmap.md` — Fixed product name (Pulse OS, not OrganiQ); removed "managed agent" reference
- `README.md` — Removed deleted doc links; added Architecture Decisions v3 and Roadmap entries

### Code: Fixed 7 circular dependencies

Extracted `ContextBuilder` + `ContextBuilderResult` interfaces to `context-builder.types.ts`. All 7 builders now import from types file instead of registry.

### Code: Deleted 12 dead files

- `server/src/shared/analysis/` (6 utils + index + spec) — ported from Python sidecar but never consumed
- `server/src/shared/utils/prompt-loader.ts` — superseded by PromptService
- `script1.js`, `script2.js` — one-off migration scripts
- `server/scripts/add-return-output.ts`, `server/scripts/export-tool-schemas.ts` — stale managed-agent deployment artifacts
- `frontend/src/shared/hooks/use-keyboard-shortcuts.ts` — unused

### Code: Fixed type gap

Added `scheduledPublishAt?: string` to frontend `ContentPiece` interface, removed 2 `as any` casts in calendar page.

### Code: Fixed stale comment

`reports.service.ts` — changed "Sending to Python sidecar" to "Generating PDF locally via PdfGeneratorService".

### Dev: Watch mode enabled

`.vscode/tasks.json` — Backend task now uses `nest start --watch` for auto-rebuild on file save.

---

## [Full-Project CTO Audit — Cleanup & Hardening] — May 19, 2026

**Comprehensive project-wide audit: 8 issues identified and fixed.**

### Fix 1 (HIGH): Stale `frontend/src/app/dashboard/` route group deleted

**Problem:** An orphaned `dashboard/keywords/[projectId]/workflows/[workflowId]/page.tsx` route existed outside the active `(dashboard)/` route group. It imported from 11 non-existent `@/features/keywords/components/*` modules, causing 37 TypeScript errors.

**Fix:** Deleted the entire `frontend/src/app/dashboard/` directory (stale route group).

### Fix 2 (HIGH): Drizzle migration metadata out of sync

**Problem:** `drizzle/0013_r11_billing.sql` existed as an orphaned file with no corresponding snapshot (`0013_snapshot.json`) or journal entry in `_journal.json`. This could cause Drizzle to re-run or fail on deploy.

**Fix:** Deleted the orphaned SQL file and regenerated via `drizzle-kit generate --name r11_billing`, producing a proper `0013_snapshot.json` + journal entry.

| File | Change |
|------|--------|
| `server/drizzle/meta/_journal.json` | Added entry idx 13 for `0013_r11_billing` |
| `server/drizzle/meta/0013_snapshot.json` | Generated full schema snapshot |
| `server/drizzle/0013_r11_billing.sql` | Regenerated with proper Drizzle metadata |

### Fix 3 (HIGH): `/billing` page unreachable from UI

**Problem:** The billing page existed at `(dashboard)/billing/page.tsx` but no navigation element linked to it — users could only reach it via direct URL or post-checkout redirect.

**Fix:** Added `Billing` link (CreditCard icon) to side-nav `BOTTOM_ITEMS` above Settings.

| File | Change |
|------|--------|
| `frontend/src/shared/components/side-nav.tsx` | Added `CreditCard` import, added `/billing` to `BOTTOM_ITEMS` |

### Fix 4 (MEDIUM): 7 stale Python sidecar references

**Problem:** The Python sidecar was removed in R10 but references remained in `.env.example`, copilot-instructions, and 5 documentation files — misleading for new developers.

**Fix:** Removed all sidecar references, updated tech stack mentions, added Stripe env vars to `.env.example`.

| File | Change |
|------|--------|
| `.env.example` | Removed `PYTHON_SIDECAR_URL`, added `STRIPE_*` vars |
| `.github/copilot-instructions.md` | Removed `python-sidecar/` from structure, updated tech stack |
| `docs/architecture/api-reference.md` | Removed Python Sidecar section |
| `docs/architecture/dependencies.md` | Removed sidecar package table, updated service table |
| `docs/features/reports.md` | Updated to reference `PdfGeneratorService` via pdfmake |
| `docs/features/keywords.md` | Removed Python Sidecar Endpoints section |
| `docs/project-handbook.md` | Removed sidecar from topology, structure, and endpoints |

### Fix 5 (MEDIUM): Unused imports in `reports.service.ts`

**Problem:** `desc` (from drizzle-orm) and `ConfigService` were imported/injected but never used — leftover from the sidecar HTTP call removal.

**Fix:** Removed both unused imports and the `ConfigService` constructor injection.

| File | Change |
|------|--------|
| `server/src/features/reports/reports.service.ts` | Removed `desc`, `ConfigService` import + injection |

### Fix 6 (MEDIUM): `method02-seed-expansion.tsx` type errors

**Problem:** TS2352 — `ExpandedKeyword` cannot be directly cast to `Record<string, unknown>` because the types don't sufficiently overlap.

**Fix:** Added intermediate `unknown` cast: `as unknown as Record<string, unknown>`.

| File | Change |
|------|--------|
| `frontend/src/features/workflow/renderers/method02-seed-expansion.tsx` | Two casts fixed via `unknown` intermediate |

### Fix 7 (LOW): Stale temp files and empty directory

**Problem:** `tmp-reasoning.txt` and `tmp-step14-output.json` contained unrelated SERP analysis data (UAE banking niche). `data/` was empty.

**Fix:** Deleted all three.

### Fix 8 (MEDIUM): `workflow-scheduler.service.ts` onModuleInit lacked error handling

**Problem:** If Redis or BullMQ queue init failed during module startup, the error propagated uncaught and could crash the application.

**Fix:** Wrapped the entire `onModuleInit` body in try-catch with error logging.

| File | Change |
|------|--------|
| `server/src/features/scheduled-workflows/workflow-scheduler.service.ts` | Added try-catch around queue registration |

### Bonus: `content/page.tsx` TypeScript errors fixed

**Problem:** Page used raw `ReactMarkdown` and `remarkGfm` without importing them (3 errors). Also had `unknown` type not assignable to `ReactNode` (1 error) due to `contentStructure` being rendered as a short-circuit expression.

**Fix:** Replaced raw `ReactMarkdown` usage with the already-imported `MarkdownPreview` component. Changed `{contentStructure && ...}` to a ternary `(contentStructure && ...) ? <div/> : null` to avoid `unknown` leaking to ReactNode.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/content/page.tsx` | ReactMarkdown → MarkdownPreview, ternary for unknown type |

**Final state:** Server tsc 0 errors, Frontend tsc 0 errors (down from 43), 93 tests passing.

---

## [CTO Review — R8–R11 Issues] — May 19, 2026

**7 issues identified from CTO review of R8–R11 implementations:**

### Issue 1 (HIGH): Open redirect via Stripe checkout URLs

**Problem:** `createCheckoutSession` passed user-supplied `successUrl`/`cancelUrl` directly to Stripe with no origin validation. Attacker could redirect users to phishing sites post-checkout.

**Fix:** Added `validateRedirectUrl()` that checks redirect URLs match the configured `FRONTEND_URL` origin. Throws `BadRequestException` on mismatch.

| File | Change |
|------|--------|
| `server/src/features/billing/billing.service.ts` | Added `validateRedirectUrl()` with origin check |

### Issue 2 (HIGH): Raw Error thrown for insufficient credits

**Problem:** `throw new Error('Insufficient credits')` in billing service bypassed NestJS exception handling, returning raw 500 to client.

**Fix:** Changed to `throw new ForbiddenException('Insufficient credits')`.

| File | Change |
|------|--------|
| `server/src/features/billing/billing.service.ts` | `Error` → `ForbiddenException` |

### Issue 3 (HIGH): PlanLimitGuard was a no-op

**Problem:** Guard always returned `true` without checking actual usage against plan limits.

**Fix:** Implemented real limit counting — queries COUNT of projects, workflows/month, and agent runs/month, compares against plan limits, throws `ForbiddenException` when exceeded.

| File | Change |
|------|--------|
| `server/src/features/billing/plan-limit.guard.ts` | Full implementation with DB COUNT queries |

### Issue 4 (MEDIUM): Retention service DELETEd agent runs

**Problem:** `DELETE FROM agent_runs` destroyed audit records, making credit debit history unverifiable.

**Fix:** Changed to `UPDATE SET response=null, recommendations=null` — preserves the audit row while freeing storage.

| File | Change |
|------|--------|
| `server/src/features/scheduled-workflows/retention.service.ts` | DELETE → UPDATE nulling response/recommendations |

### Issue 5 (LOW): Blank line in reports.service.ts

Fixed trivial formatting.

### Issue 6 (MEDIUM): Webhook threw generic `Error`

**Problem:** `throw new Error(...)` in webhook handler bypassed NestJS exception filters.

**Fix:** Changed to `throw new BadRequestException(...)`.

| File | Change |
|------|--------|
| `server/src/features/billing/billing.service.ts` | `Error` → `BadRequestException` in webhook |

### Issue 7 (LOW): Unused imports in side-nav.tsx

Removed unused icon imports: `Zap`, `Search`, `Network`, `BarChart3`.

---

## [R11 — Stripe Billing] — May 19, 2026

### Billing Module

Full Stripe billing integration with subscription plans, credit packs, and customer portal.

| File | Purpose |
|------|---------|
| `server/src/features/billing/billing.service.ts` | Stripe checkout, portal, webhook handler |
| `server/src/features/billing/billing.controller.ts` | REST endpoints with DTOs |
| `server/src/features/billing/billing.module.ts` | Module registration |
| `server/src/features/billing/plan-limit.guard.ts` | PlanLimitGuard + @PlanLimit() decorator |
| `frontend/src/features/billing/services/billing.service.ts` | Frontend API client |
| `frontend/src/app/(dashboard)/billing/page.tsx` | Plan cards + credit packs UI |

### API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/billing/webhook` | Stripe webhook receiver | Stripe signature |
| `POST` | `/billing/:orgId/checkout` | Create subscription checkout | ClerkGuard + OrgMembership |
| `POST` | `/billing/:orgId/purchase-credits` | Buy credit pack | ClerkGuard + OrgMembership |
| `POST` | `/billing/:orgId/portal` | Open Stripe customer portal | ClerkGuard + OrgMembership |
| `GET` | `/billing/:orgId/subscription` | Get current subscription | ClerkGuard + OrgMembership |

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate subscription or credit purchase record |
| `customer.subscription.updated` | Sync plan/status/period changes |
| `customer.subscription.deleted` | Mark subscription as canceled |
| `invoice.paid` | Credit monthly allocation to org ledger |

### Schema Changes (Migration 0013)

- `subscriptions` table — Stripe subscription tracking (status, plan, period dates, credits)
- `purchases` table — One-time credit pack purchases
- `subscription_status` enum — active, past_due, canceled, trialing, incomplete
- Indexes on org_id, stripe_subscription_id (unique), stripe_payment_intent_id (unique)

### PlanLimitGuard

Decorator-based usage enforcement:
```typescript
@PlanLimit('projects')           // Max projects per org
@PlanLimit('workflowsPerMonth')  // Monthly workflow run cap
@PlanLimit('agentRunsPerMonth')  // Monthly agent run cap
```

---

## [R10 — PDF Port, Nav Restructure, Retention] — May 19, 2026

### PDF Generation — Python Sidecar → pdfmake

Replaced the Python sidecar HTTP call with a local NestJS service using `pdfmake`.

| File | Purpose |
|------|---------|
| `server/src/features/reports/pdf/pdf-generator.service.ts` | PDF rendering (Helvetica font, A4, brand color #E11D48) |

Features:
- Title page with brand header
- Section rendering with heading levels
- Markdown parsing: tables, bullets, bold, horizontal rules
- 25mm margins, A4 format

### Navigation Restructure

Replaced the project-level sidebar with a cleaner 8-item nav:

| Route | Label | Icon |
|-------|-------|------|
| `overview` | Overview | LayoutGrid |
| `ai-search` | AI Search | Eye |
| `analytics` | Analytics | Activity |
| `technical` | Technical | Wrench |
| `agents` | Agents | Bot |
| `content` | Content | FileText |
| `research` | Research | FlaskConical |
| `settings` | Settings | Settings |

New route pages created under `(dashboard)/workspaces/[wId]/projects/[pId]/`.

### Data Retention Service

Weekly cron job managing data lifecycle:

| Data | Policy | Action |
|------|--------|--------|
| LLM traffic sessions | >90 days | DELETE (raw session data not needed) |
| Agent run responses | >30 days | UPDATE SET null (preserves audit row) |

### Python Sidecar Removal

- Deleted `python-sidecar/` directory entirely
- Removed `PYTHON_SIDECAR_URL` from env validation
- Updated system topology diagram

---

## [R8/R9 CTO Review Fixes] — May 19, 2026

**8 issues fixed from CTO review of R8 (On-Demand Agents) and R9 (Scheduled Workflows):**

1. Added class-validator decorators to all DTO fields
2. Added `@IsEmail()` to `deliveryTarget` when channel is `email`
3. Removed hardcoded `projectId` fallback
4. Optimized DB queries (moved filtering from JS to SQL WHERE clause)
5. Fixed `cron-parser` v5 API (uses `parseExpression().fields` not `parseExpression().next()`)
6. Added `@IsUrl()` validation on Slack webhook URL
7. Added `@MaxLength()` constraints on all string fields
8. Fixed scheduled-workflows response format consistency

---

## [R8 — On-Demand Agents] — May 19, 2026

### On-Demand Agents Module

Natural-language agent interface for ad-hoc project analysis.

| File | Purpose |
|------|---------|
| `server/src/features/on-demand-agents/on-demand-agents.controller.ts` | REST API (`projects/:projectId/agents`) |
| `server/src/features/on-demand-agents/on-demand-agents.service.ts` | Agent execution, history |
| `server/src/features/on-demand-agents/agent-router.service.ts` | Route prompts to agent types |
| `server/src/features/on-demand-agents/on-demand-agents.module.ts` | Module registration |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/:projectId/agents/run` | Execute agent with prompt |
| `GET` | `/projects/:projectId/agents/history` | Get run history |
| `GET` | `/projects/:projectId/agents/types` | List available agent types |

### Schema (Migration 0012)

- `agent_runs` table — Execution log (prompt, response, recommendations, cited_data, credit_cost, status, duration)
- `agent_run_status` enum — running, completed, failed

---

## [R9 — Scheduled Workflows] — May 19, 2026

### Scheduled Workflows Module

Cron-based recurring agent execution with email/Slack delivery.

| File | Purpose |
|------|---------|
| `server/src/features/scheduled-workflows/scheduled-workflows.controller.ts` | REST CRUD |
| `server/src/features/scheduled-workflows/scheduled-workflows.service.ts` | Business logic + run history |
| `server/src/features/scheduled-workflows/scheduled-workflows.processor.ts` | BullMQ processor (check-due-workflows) |
| `server/src/features/scheduled-workflows/workflow-scheduler.service.ts` | Registers repeatable BullMQ job |
| `server/src/features/scheduled-workflows/retention.service.ts` | Weekly data cleanup cron |
| `server/src/features/scheduled-workflows/scheduled-workflows.module.ts` | Module registration |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/:projectId/scheduled-workflows` | Create schedule |
| `GET` | `/projects/:projectId/scheduled-workflows` | List schedules |
| `GET` | `/projects/:projectId/scheduled-workflows/:id` | Get schedule |
| `PATCH` | `/projects/:projectId/scheduled-workflows/:id` | Update schedule |
| `DELETE` | `/projects/:projectId/scheduled-workflows/:id` | Delete schedule |
| `GET` | `/projects/:projectId/scheduled-workflows/:id/history` | Get run history |

### Schema (Migration 0012)

- `scheduled_workflows` table — Schedule definition (name, agent_type, prompt, cron, delivery_channel/target, is_active, next_run_at)
- `workflow_run_history` table — Execution log per scheduled workflow (status, response, delivered, error)

---

## [QA Audit Fixes — Round 2] — May 12, 2026

**Findings from browser-based QA audit, 4 issues fixed:**

### Fix 1 (HIGH): Workflow auth contract — org resolution from project/run context

**Problem:** `OrgMembershipGuard` threw 403 on workflow routes (`GET /workflows/project/:projectId`, `GET /workflows/:id`) because the JWT has no `org_id` claim and these routes don't carry an explicit `organizationId` param.

**Fix:** Added two fallback resolution paths in the guard: (1) resolve org from `projectId` in route params or request body, (2) resolve org from workflow `runId` on `/workflows/:id` routes. Membership is still verified after resolution.

| File | Change |
|------|--------|
| `server/src/features/auth/org-membership.guard.ts` | Added project-based and workflow-run-based org resolution fallbacks |

### Fix 2 (HIGH): Surface workflow load errors

**Problem:** Workflow runs page silently swallowed API errors via `.catch(() => {})`, making 403/500 failures appear as an empty "No workflow runs yet" state.

**Fix:** Added `error` state, replaced silent catch with error message extraction, and render the error inline above the runs list.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/workflows/page.tsx` | Added error state, replaced silent `.catch` with user-visible error display |

### Fix 3 (MEDIUM): Project-scoped navigation

**Problem:** Sidebar and command palette only showed Workspaces and Settings. When inside a project, there was no way to navigate to Keywords, Content, Workflows, Topical Map, or Reports without manually editing the URL.

**Fix:** Sidebar detects project context from the URL and renders contextual nav items (Workflows, Keywords, Content, Topical Map, Reports) with a "Back to Projects" link. Command palette adds matching project-scoped commands.

| File | Change |
|------|--------|
| `frontend/src/shared/components/side-nav.tsx` | Added project-scoped nav items with URL-based context detection |
| `frontend/src/shared/components/command-palette.tsx` | Added project-scoped commands when inside a project route |

### Fix 4 (MEDIUM): Settings API endpoint display

**Problem:** Settings page showed `window.location.origin/api` (e.g., `http://localhost:3001/api`) as the API endpoint, but the actual backend runs at `http://localhost:3002`.

**Fix:** Replaced with `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'` to show the real backend URL.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/settings/page.tsx` | Fixed API endpoint to show actual backend URL |

---

## [Frontend Route Consistency Fix] — May 12, 2026

**Problem:** Next.js would not start because the workspace projects route used `/workspaces/[id]/projects` while sibling routes used `/workspaces/[wId]/...`. App Router treats those as the same dynamic segment and aborts startup on the slug mismatch.

**Fix:** Moved the projects page under the existing `[wId]` route tree and removed the conflicting `[id]` route.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/page.tsx` | Added projects page under the normalized workspace slug |
| `frontend/src/app/(dashboard)/workspaces/[id]/projects/page.tsx` | Removed conflicting dynamic route |

---

## [Public Route Protection Fix] — May 12, 2026

**Problem:** The frontend middleware protected `/audit` and `/login` even though those pages are intended public entry points. In local dev, hitting either route triggered Clerk's sign-in redirect path and failed before render when Clerk keys were not configured. After that was corrected, `/audit` still resolved to 404 because the current app tree no longer contains a public audit page.

**Fix:** Added a real `/login` page backed by Clerk `SignIn`, replaced `auth.protect()` with an explicit redirect to `/login`, and treated `/audit` as a compatibility entry path that forwards to `/workspaces`.

| File | Change |
|------|--------|
| `frontend/src/app/login/page.tsx` | Added a real Clerk-powered sign-in route with a fallback redirect to `/workspaces` |
| `frontend/src/middleware.ts` | Added `/login(.*)` to the public-route matcher, redirected `/audit` to `/workspaces`, and redirected unauthenticated protected routes to `/login` |
| `docs/features/auth.md` | Documented `/login` as the frontend sign-in route and `/audit` as a compatibility redirect |

---

## [Workspace Create Flow Fix] — May 12, 2026

**Problem:** The workspaces entry page rendered a `New Workspace` button with no click handler, no list loading, and no API integration, so the primary CTA on `/workspaces` was inert.

**Fix:** Connected the page to the existing workspaces API and made the CTA organization-aware. The page now loads workspaces for the active organization, uses the `New Workspace` action to activate or create an organization when none is selected, opens an inline create form, posts to `POST /workspaces`, and routes into the new workspace’s projects page.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/workspaces/page.tsx` | Added workspace loading, inline create form, create submit handler, and workspace cards |
| `docs/features/workspaces-projects.md` | Updated frontend route docs to use `:wId` and documented the create flow |

---

## [Project Create Flow Fix] — May 12, 2026

**Problem:** The workspace projects page rendered a `New Project` button as static markup with no handler, no project loading, and no connection to the backend `projects` API. Users could reach `/workspaces/:wId/projects` after creating a workspace, but the primary CTA on that page did nothing.

**Fix:** Replaced the placeholder page with a real client-side flow that loads the current workspace from the existing workspaces API, shows existing projects, opens an inline create form, posts to `POST /projects`, and routes into the new project’s workflow runs page after creation.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/page.tsx` | Added workspace-backed project loading, inline create form, project cards, and post-create routing |
| `docs/features/workspaces-projects.md` | Documented the projects list/create flow and workflow-run redirect |

---

## [CTO Audit Fixes] — May 12, 2026

9 findings from a comprehensive codebase audit. 8 fixed, 1 deferred.

### Batch 1 — Report Download Contract Fix (Finding 1B/1C) — HIGH

**Problem:** The `ReportsController.download()` method streamed raw PDF binary via `@Res()` and Express `res.end(buffer)`, but the frontend called `apiFetch<{ base64, title }>()` which always parses `res.json()`. Contract mismatch caused runtime failure on every report download.

**Fix:** Removed `@Res()` decorator and `Response` import from the controller. The download endpoint now returns the JSON `{ base64, title }` object directly via NestJS's built-in serialization, matching the frontend contract.

| File | Change |
|------|--------|
| `server/src/features/reports/reports.controller.ts` | Removed `@Res()`, `Response` import; return `this.reportsService.download()` as JSON |

---

### Batch 2 — Reports Page Route Mismatch (Finding 1A) — HIGH

**Problem:** The reports page fetched workflow runs via `GET /projects/${projectId}/workflows/runs` but the actual backend route is `GET /workflows/project/${projectId}`. Every reports page load failed to retrieve workflow runs.

**Fix:** Corrected the URL in the frontend fetch call.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/reports/page.tsx` | `/projects/${projectId}/workflows/runs` → `/workflows/project/${projectId}` |

---

### Batch 3 — Navigation Route Drift (Finding 2) — HIGH

**Problem:** SideNav linked to `/projects`, `/keywords`, `/content`, `/reports`, `/credits` — none of which have backing `page.tsx` files. These are project-scoped features requiring workspace/project context in the URL. Command palette had the same broken links plus action commands navigating to non-existent `/reports`.

**Fix:** Removed all broken navigation items. SideNav now shows only `/workspaces`. Command palette shows only `/workspaces` and `/settings`. Removed unused icon imports (`FolderKanban`, `Search`, `FileText`, `BarChart3`, `Coins`, `Play`, `Brain`, `BookOpen`).

| File | Change |
|------|--------|
| `frontend/src/shared/components/side-nav.tsx` | Removed 5 broken `NAV_ITEMS`; kept `/workspaces` only |
| `frontend/src/shared/components/command-palette.tsx` | Removed 6 broken page commands + 2 action commands; kept `/workspaces` and `/settings` |

---

### Batch 4A — Settings Credits Contract Mismatch (Finding 3) — HIGH

**Problem:** Settings page called `GET /credits/balance` without `organizationId`, but the backend requires `GET /credits/:organizationId/balance`. Additionally, the frontend expected `{ balance, totalUsed }` but the controller only returns `{ balance }`. The credits card always showed "Unable to load credit information".

**Fix:** Removed the broken credits card entirely from settings. The credits endpoint requires an org ID that the settings page doesn't have in the URL context. Credits management will be accessible via a dedicated route when workspace/project navigation is enhanced.

| File | Change |
|------|--------|
| `frontend/src/app/(dashboard)/settings/page.tsx` | Removed `CreditBalance` interface, `credits` state, `loadCredits()` effect, credits card UI, unused `Key`/`CreditCard` imports, unused `useState`/`useEffect`/`apiFetch` imports |

---

### Batch 4B — Sidecar Config Nomenclature Split (Finding 4) — HIGH

**Problem:** Two different env var names for the same service. Reports service used `SIDECAR_URL` with default `http://localhost:3003`. GSC service used `PYTHON_SIDECAR_URL` with default `http://localhost:8000`. Neither was validated in `env.validation.ts`. The wrong default (`3003` vs `8000`) would cause reports to fail connecting to the sidecar.

**Fix:** Unified on `PYTHON_SIDECAR_URL` with correct default `http://localhost:8000`. Added to env validation.

| File | Change |
|------|--------|
| `server/src/features/reports/reports.service.ts` | `SIDECAR_URL` → `PYTHON_SIDECAR_URL`, default `http://localhost:8000` |
| `server/src/shared/config/env.validation.ts` | Added `@IsOptional() @IsString() PYTHON_SIDECAR_URL?: string` |

---

### Batch 5A — Integration Retry Standardization (Finding 6) — MEDIUM

**Problem:** Only OpenAI had retry logic for transient failures (429/5xx). Six other integration services were single-shot — any transient network error or rate limit would immediately fail the entire workflow step. The shared `withRetry()` utility existed at `server/src/shared/utils/retry.ts` but was never imported.

**Fix:** Wrapped the core `fetch()` call in every integration service with `withRetry()` (3 attempts, exponential backoff).

| File | Change |
|------|--------|
| `server/src/features/integrations/ahrefs/ahrefs.service.ts` | `request()` wrapped with `withRetry()` |
| `server/src/features/integrations/dataforseo/dataforseo.service.ts` | `request()` wrapped with `withRetry()` |
| `server/src/features/integrations/serper/serper.service.ts` | `post()` wrapped with `withRetry()` |
| `server/src/features/integrations/firecrawl/firecrawl.service.ts` | `post()` and `get()` wrapped with `withRetry()` |
| `server/src/features/integrations/pagespeed/pagespeed.service.ts` | `analyze()` and `getCruxData()` wrapped with `withRetry()` |
| `server/src/features/integrations/gsc/gsc.service.ts` | `post()` wrapped with `withRetry()` |

---

### Batch 5B — Webhook Idempotency (Finding 7) — MEDIUM

**Problem:** Webhook handlers used bare `insert().returning()`. On process restart, replayed Clerk webhooks would hit unique constraint violations (on `clerkOrgId` for orgs, on `(organizationId, clerkUserId)` for members) and throw 500 errors. The in-memory `processedWebhooks` Map was lost on restart.

**Fix:** Changed both inserts to use `.onConflictDoNothing().returning()`. On conflict, `handleOrgCreated` falls back to `findOrgByClerkId()` to return the existing record. `handleMemberCreated` returns `null` on conflict (already a member).

| File | Change |
|------|--------|
| `server/src/features/auth/auth.service.ts` | Both `insert()` calls changed to `insert().onConflictDoNothing().returning()` with fallback lookups |

---

### Batch 5C — Agent Runtime Timer Leaks (Finding 8) — MEDIUM

**Problem:** Both `Promise.race` patterns in the agent runtime (agent-level timeout at 10 min, tool-level timeout at 60s) used `setTimeout` inside a promise constructor but never called `clearTimeout` on the success path. After every completed agent run or tool call, the timer continued running until it naturally expired, holding a reference and wasting resources. Over many workflow steps, dozens of stale timers accumulated.

**Fix:** Stored the timer ID in a variable and added `clearTimeout()` immediately after `Promise.race` resolves.

| File | Change |
|------|--------|
| `server/src/agents/agent.runtime.ts` | Added `clearTimeout(timer!)` after both `Promise.race` blocks |

---

### Deferred — Light Theme Completeness (Finding 9) — MEDIUM-LOW

**Problem:** CSS variables are defined in `globals.css` for `[data-theme="light"]`, and a theme toggle exists in the top bar. However, all component classes hardcode dark-theme Tailwind tokens (`bg-zinc-800`, `text-white`, `border-zinc-700`, etc.). The toggle changes shell-level colors but leaves all content components in dark mode.

**Status:** Deferred. Fixing requires replacing hardcoded Tailwind classes across 30+ component files with CSS variable-backed design tokens. This is a design system migration, not a bug fix. Recommended approach: either complete the migration in a dedicated UI pass, or remove the theme toggle to avoid a half-working feature.

---

## [Phase H — Reports, Settings, UX Polish] — May 2026

### H1 — Report Templates
Created 4 Markdown report templates in `server/src/prompts/reports/`:
- `full-strategy.template.md` — Complete strategy report
- `ai-visibility.template.md` — AI/GEO/AEO visibility analysis
- `keyword-research.template.md` — Keyword research summary
- `content-plan.template.md` — Content calendar

### H2 — PDF Generation Sidecar *(superseded by R10 — replaced with pdfmake)*
Added `POST /reports/pdf` endpoint to Python sidecar using ReportLab:
- Accepts `{ title, project_domain, report_type, sections: [{ title, content, level }] }`
- Returns `{ pdf_base64, page_count, file_size_bytes }`
- Added `reportlab>=4.1.0` and `markdown>=3.5.0` to `requirements.txt`

### H3 — Reports Module (Backend)
Full CRUD + generate in `server/src/features/reports/`:
- `ReportsService`: `findAllByProject`, `findById`, `generate`, `download`, `remove`
- `ReportsController`: REST under `projects/:projectId/reports`
- Template interpolation with workflow context data
- Registered in `AppModule`

### H4 — Reports Frontend
- `frontend/src/features/reports/services/reports.service.ts` — API service
- `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/reports/page.tsx` — Reports list + generate modal

### H5 — Settings Page
- `frontend/src/app/(dashboard)/settings/page.tsx` — Profile, organization, security info from Clerk

### H6 — Command Palette
- `frontend/src/shared/components/command-palette.tsx` — `Cmd+K` activated, categorized commands, search, keyboard navigation

### H7 — Keyboard Shortcuts
- `frontend/src/shared/hooks/use-keyboard-shortcuts.ts` — Reusable hook for global keyboard bindings

### H8 — Theme Toggle
- `frontend/src/shared/hooks/use-theme.tsx` — Theme context with `localStorage` persistence
- `frontend/src/shared/components/top-bar.tsx` — Sun/Moon toggle button
- `frontend/src/app/globals.css` — `[data-theme="light"]` CSS variables
- `frontend/src/app/(dashboard)/layout.tsx` — `ThemeProvider` wrapper

---

## [Phases A–G] — April–May 2026

See `docs/implementation-plan.md` for the complete 90-task checklist across all phases:

- **Phase A** — Foundation (Drizzle schema, NestJS modules, Clerk auth, WebSocket gateway)
- **Phase B** — Agent Runtime (registry, runtime, tool sandbox, output validator)
- **Phase C** — Workflow UI (run list, run detail, step cards, approval flow, real-time updates)
- **Phase D** — Discovery agents (business-profile, seed-keywords, competitor-buckets, SERP niche map, AI intelligence)
- **Phase E** — Research agents (site-audit, competitor-metrics, search-demand, phase1-baseline)
- **Phase F** — Keyword agents (competitor-pages, seed-expansion, content-gap, consolidation, topical-map)
- **Phase G** — Content agents (content-brief, content-article, verdict-strategy, scoring rubrics)

---

## [Audit Fix Batches 1–8] — May 2026

22 fixes from the Phase A+B+C audit (`docs/debugging/phase-abc-audit.md`):

| Batch | Fixes |
|-------|-------|
| 1 | Auth guard on all controllers, BullMQ queue binding |
| 2 | Tool registration in bootstrap, organization resolution |
| 3 | Credit debit atomicity (ledger + balance in transaction) |
| 4 | WebSocket auth, DTO validation, env validation |
| 5 | Workflow run authorization, agent output validation |
| 6 | Input sanitization, error boundaries |
| 7 | Health check improvements, logging |
| 8 | Frontend auth middleware, API error handling |
