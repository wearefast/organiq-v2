# Frontend Contracts Audit — Pulse OS

> **Last audited:** June 4, 2026 (Release 13 — CTO Deep Audit)
> **Auditor:** CTO / Principal Engineer
> **Frontend directory:** `frontend/src/`

---

## Overview

This document maps the frontend's surface area against backend contracts. Use it to catch:
- API endpoint mismatches (wrong path, wrong method, missing auth)
- Type drift between frontend interfaces and Drizzle schema
- WebSocket event names that don't match the gateway
- Missing error handling at API boundaries

---

## REST API Contracts

### Workflow Endpoints

| Frontend Call Site | HTTP | Backend Route | Auth | Notes |
|-------------------|------|---------------|------|-------|
| `workflow.service.ts` → `startRun()` | POST | `/workflows/:id/start` | Clerk JWT | |
| `workflow.service.ts` → `getRunDetail()` | GET | `/workflows/:id` | Clerk JWT | Returns steps + artifacts |
| `workflow.service.ts` → `listRuns()` | GET | `/workflows/project/:projectId` | Clerk JWT | |
| `workflow.service.ts` → `approveStep()` | POST | `/workflows/:id/steps/:stepKey/approve` | Clerk JWT | |
| `workflow.service.ts` → `reviseStep()` | POST | `/workflows/:id/steps/:stepKey/revise` | Clerk JWT | |
| `workflow.service.ts` → `rejectStep()` | POST | `/workflows/:id/steps/:stepKey/reject` | Clerk JWT | |

### Project / Workspace Endpoints

| Frontend Call Site | HTTP | Backend Route | Auth | Notes |
|-------------------|------|---------------|------|-------|
| `project.service.ts` | GET/POST/PATCH | `/projects/*` | Clerk JWT | |
| `workspace.service.ts` | GET/POST/PATCH | `/workspaces/*` | Clerk JWT | |

### Credits / Billing

| Frontend Call Site | HTTP | Backend Route | Auth | Notes |
|-------------------|------|---------------|------|-------|
| `credits.service.ts` → balance | GET | `/credits/balance` | Clerk JWT | |
| `billing.service.ts` → checkout | POST | `/billing/checkout` | Clerk JWT | Returns Stripe URL |
| `billing.service.ts` → portal | GET | `/billing/portal` | Clerk JWT | Returns Stripe portal URL |

---

## WebSocket Event Contracts

Gateway: `server/src/features/workflows/workflow.gateway.ts`
Frontend listener: `frontend/src/features/workflow/hooks/useWorkflowSocket.ts` (or equivalent)

| Event Name (Server → Client) | Payload Shape | Trigger |
|------------------------------|---------------|---------|
| `step:started` | `{ workflowRunId, stepKey, status: 'running' }` | Step dequeued |
| `step:completed` | `{ workflowRunId, stepKey, status: 'completed', artifact: {...} }` | Step successful |
| `step:awaiting_approval` | `{ workflowRunId, stepKey, status: 'awaiting_approval' }` | Step requires human sign-off |
| `step:failed` | `{ workflowRunId, stepKey, status: 'failed', error: string }` | Step error |
| `run:completed` | `{ workflowRunId, status: 'completed' }` | All steps done |
| `run:failed` | `{ workflowRunId, status: 'failed' }` | Run terminal failure |

> Verify event names match exactly. Any mismatch causes silent real-time update failures.

---

## Artifact Renderer Contracts

Each step has a dedicated renderer in `frontend/src/features/workflow/renderers/`. Renderers consume the artifact JSON stored in `step_artifacts.data`.

| Step Key | Renderer File | Key Fields Rendered | Last Verified |
|----------|--------------|---------------------|---------------|
| business-profile | `business-profile.renderer.tsx` | domain_authority, services, target_market | R12 |
| seed-keywords | `seed-keywords.renderer.tsx` | seedKeywords[], categories[] | R12 |
| competitor-metrics | `competitor-metrics.renderer.tsx` | competitorMetrics[].domainRating, .keywords[], targetMetrics | R12 — keywords[] field added |
| method01-competitor-pages | `method01.renderer.tsx` | discoveredKeywords[], competitorPages[] | R12 |
| consolidated-keywords | `consolidated-keywords.renderer.tsx` | masterKeywordList[], clusters[] | R12 |
| verdict-strategy | `verdict-strategy.renderer.tsx` | verdict, SWOT, priorityMatrix | R12 |
| topical-map | `topical-map.renderer.tsx` | pillars[], calendar[], linkingArchitecture | R12 |
| content-brief | `content-brief.renderer.tsx` | targetKeyword, contentStructure, wordCountTarget | R13 — ⚠️ `targetKeyword` rendered but pipeline NEVER populates it (critical bug). Renderer will always show empty keyword until pipeline fix is deployed. |

---

## Type Safety Gaps (Known)

| Surface | Gap | Risk | Action |
|---------|-----|------|--------|
| `content-brief` artifact | `serpResults` and `scrapedPages` always null due to pipeline bug | 🔴 Critical | Fix `content-brief.pipeline.ts` — see prompt-audit.md |
| `content-brief` artifact | Renderer shows `targetKeyword` but it's always empty (pipeline never fetches it) | 🔴 Critical | Same fix |
| `competitor-metrics` artifact | Frontend type for `keywords[]` field not yet added to artifact type | Medium — renderer may show stale shape | Add `keywords: Array<{ keyword, volume, difficulty, position, url }>` to artifact type |
| `method01-competitor-pages` artifact | `competitorPagesResults[].keywords` shape not in frontend type | Medium | Update interface to match pipeline output |
| `workflowContext` type | Frontend stores context as `Record<string, unknown>` — no discriminated union | Low | Acceptable for now; would break if step keys change |
| Step artifact `metadata` | `organicKeywordsSource` field added in R12 (phase1-baseline) — not reflected in frontend type | Low | Add to frontend type when baseline renderer is built |
| WebSocket CORS | Gateway uses `process.env.FRONTEND_URL` directly, not ConfigService | Low | Switch to ConfigService for consistency |

---

## Zustand Store Contracts

| Store | State Shape | Backend Source | Notes |
|-------|------------|----------------|-------|
| Workflow run store | `{ run, steps, currentStep }` | GET `/workflows/:id` | Polling or WebSocket |
| Credits store | `{ balance, transactions[] }` | GET `/credits/balance` | Refresh on step completion |
| Project store | `{ project, workflows[] }` | GET `/projects/:id` | |

---

## Authentication Contract

All authenticated routes require the Clerk JWT in the `Authorization: Bearer <token>` header. The frontend uses Clerk's `useAuth().getToken()` to attach this. The backend validates via `ClerkGuard`.

| Scenario | Frontend Handling | Backend Response |
|----------|------------------|-----------------|
| Valid token | Request proceeds | 200 |
| Expired token | Clerk auto-refreshes | — |
| Unauthorised org/resource | — | 403 |
| Missing token | — | 401 |

---

## Frontend Contracts Audit Checklist Template

- [ ] All `apiFetch()` call sites match an active route in `docs/architecture/api-reference.md`
- [ ] WebSocket event names in frontend listeners match gateway emit names exactly
- [ ] Artifact renderers handle the current schema (not an old shape from before a pipeline rewrite)
- [ ] Type interfaces for step artifacts updated whenever a pipeline output shape changes
- [ ] `useAuth().getToken()` is called on every authenticated API call (no cached stale tokens in fetch logic)
- [ ] Error boundaries exist for artifact renderers (malformed artifact should not crash the page)
