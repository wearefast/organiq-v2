# Pulse Project Handbook

## Purpose

This file is the single-file reference for the entire Pulse codebase.

It explains:

- what the product is
- which user journeys the product supports
- how the frontend, backend, database, queues, and external services connect
- which modules own which responsibilities
- how data moves from lead capture to audit output, keyword research, and content handoff
- which parts are implemented today versus planned next

## Product Summary

| Item | Description |
|------|-------------|
| Product name | Calibrate Commerce (Pulse) |
| Product category | Multi-tenant SaaS for organic visibility operations |
| Core promise | Turn website data, competitor intelligence, and strategist review into audits, keyword plans, topical maps, and content handoffs |
| Public surface | Free audit lead magnet |
| Authenticated surface | Dashboard for audits, keyword research, topical planning, content, and lead management |
| Primary domains | SEO, GEO, AEO, competitor research, content planning |

## Product Lanes

Pulse currently has two distinct product lanes.

| Lane | Audience | Main outcome | Source of truth |
|------|----------|--------------|-----------------|
| Public audit lane | Website visitors / prospective leads | Fast automated audit and lead capture | `audits` plus linked `leads` |
| Keyword workspace lane | Internal strategists / authenticated users | Human-in-the-loop research, approvals, topical maps, and content handoffs | Keyword workflow entities and approved artifacts |

The most important product boundary in the repo is this:

| Boundary | Meaning |
|----------|---------|
| Public audit is acquisition-first | It is optimized for speed, automation, and diagnostics |
| Dashboard workflow is review-first | It is intended to become the durable source of truth for approved research and downstream content |
| Audit output is not the final keyword authority | Audit raw data can inform the strategist workflow, but it should not replace approved workflow artifacts |

## Primary User Journeys

| Journey | Start | End | Main systems involved |
|--------|-------|-----|-----------------------|
| Lead magnet audit | `/audit` | Saved lead, saved audit, rendered score/results | Next.js, NestJS, BullMQ, PostgreSQL, OpenAI, Ahrefs, Serper, PageSpeed |
| Lead review | `/dashboard/leads` | Updated lead status and internal notes | Next.js drawer UI, `PATCH /leads/:id`, PostgreSQL |
| Audit review | `/dashboard/audits` | Human inspection of audit results | Next.js dashboard, `GET /audits`, PostgreSQL |
| Keyword project workflow | `/dashboard/keywords` | Approved artifacts, final keyword ledger, topical map | Next.js workflow shell, NestJS keyword module, PostgreSQL |
| Content handoff | keyword workflow approval | Persisted brief/article-ready content piece | Keyword workflow, content module, PostgreSQL, OpenAI |
| Content review | `/dashboard/content` | Preview of persisted brief/article payloads | Next.js modal UI, `GET /content`, `GET /content/:id`, PostgreSQL |

## System Context

```text
Browser
  |
  v
Next.js frontend (App Router, dashboard + public audit)
  |
  | REST over fetch via apiFetch()
  v
NestJS API
  |
  +--> PostgreSQL via Drizzle ORM
  |
  +--> Redis via BullMQ
  |
  +--> External services
        - OpenAI
        - Ahrefs
        - Serper.dev
        - Google PageSpeed Insights
        - Scraper / Lighthouse-based utilities
```

## Runtime Topology

| Layer | Runtime | Responsibility |
|------|---------|----------------|
| Frontend | Next.js 15 | Public marketing/audit UI and authenticated dashboard UI |
| Backend | NestJS 10 | REST API, workflow persistence, queue orchestration, integrations |
| Database | PostgreSQL 16 | Primary persistence for leads, audits, projects, keywords, topical maps, content |
| Queue | Redis 7 + BullMQ | Background jobs for audit, keyword, and content operations |
| ORM | Drizzle ORM | Typed schema and SQL access |

## Tech Stack

| Concern | Technology |
|--------|------------|
| Frontend framework | Next.js 15 |
| Frontend language | TypeScript + React 19 |
| Styling | Tailwind CSS |
| Backend framework | NestJS 10 |
| Validation | `ValidationPipe`, `class-validator`, `class-transformer` |
| ORM | Drizzle ORM |
| Database driver | `pg` |
| Queue orchestration | BullMQ |
| Redis client | `ioredis` |
| AI | OpenAI |
| SEO/market data | Ahrefs |
| SERP discovery | Serper.dev |
| Performance analysis | Google PageSpeed Insights + local Lighthouse fallback |
| Scraping | Cheerio-based scraping utilities |

## Repository Layout

```text
Pulse/
├── frontend/                Next.js application
│   └── src/
│       ├── app/             Routes, layouts, pages
│       ├── features/        Feature-scoped UI/services
│       └── shared/          Shared components, hooks, utilities
├── server/                  NestJS API and workers
│   └── src/
│       ├── app.module.ts    Root module wiring
│       ├── main.ts          Bootstrap, CORS, Swagger, pipes
│       ├── db/              Drizzle schema, client, seed
│       ├── features/        Feature modules
│       └── shared/          Shared backend modules
├── docs/                    Project documentation
├── infra/                   Local Docker services
└── .github/                 Repository-specific Copilot instructions
```

## Module Ownership

| Concern | Frontend owner | Backend owner | Storage owner | Async / external dependencies |
|--------|----------------|---------------|---------------|-------------------------------|
| Public audit intake | `features/audit` | `features/leads`, `features/audit` | `leads`, `audits` | `audit-queue`, OpenAI, Ahrefs, Serper, PSI |
| Audit result review | `app/dashboard/audits` | `features/audit` | `audits` | Reads persisted audit output |
| Lead management | `features/leads` | `features/leads` | `leads` | None beyond API persistence |
| Keyword project management | `app/dashboard/keywords` + `features/keywords` | `features/keywords` | `keyword_projects`, workflow tables, `keywords`, `topical_maps` | `keyword-queue`, integrations |
| Content preview and persistence | `app/dashboard/content` + `features/content` | `features/content` | `content_pieces` | `content-queue`, OpenAI |
| External integrations | none directly | `features/integrations` | Cached/derived audit or workflow output | OpenAI, Ahrefs, Serper, PSI |

## Local Development Setup

### Root Commands

| Command | Purpose |
|--------|---------|
| `npm run install:all` | Install root, frontend, and server dependencies |
| `npm run dev` | Run frontend and server concurrently |
| `npm run infra:up` | Start Postgres and Redis containers |
| `npm run infra:down` | Stop Postgres and Redis containers |
| `npm run db:push` | Push Drizzle schema to the database |
| `npm run db:seed` | Seed development data |
| `npm run format` | Format TS, JS, JSON, and Markdown files |

### Package-Level Commands

| Package | Command | Purpose |
|--------|---------|---------|
| `frontend` | `npm run dev` | Start Next.js dev server |
| `frontend` | `npm run build` | Production build |
| `frontend` | `npm run typecheck` | Frontend TypeScript check |
| `server` | `npm run dev` | Start NestJS in watch mode |
| `server` | `npm run build` | Compile NestJS app |
| `server` | `npm run typecheck` | Backend TypeScript check |
| `server` | `npm run db:generate` | Generate Drizzle artifacts |
| `server` | `npm run db:push` | Push Drizzle schema |
| `server` | `npm run db:migrate` | Run migrations |
| `server` | `npm run db:studio` | Open Drizzle Studio |

### Local Infrastructure

| Service | Container image | Host port | Container port | Notes |
|--------|------------------|-----------|----------------|-------|
| PostgreSQL | `postgres:16-alpine` | `5433` | `5432` | DB name `calibrate_commerce`, user/password `calibrate` |
| Redis | `redis:7-alpine` | `6379` | `6379` | Used by BullMQ |

### Port Notes

Source defaults and active local workflow are slightly different.

| Surface | Source default | Common local workspace practice | Why |
|--------|----------------|----------------------------------|-----|
| Frontend app | `3001` | `3001` | `frontend/package.json` runs `next dev --port 3001` |
| Backend API | `3001` | `3002` | `server/src/main.ts` defaults to `3001`, but local tasks often override to `3002` to avoid colliding with the frontend |
| Frontend API fallback | `3002` | `3002` | `frontend/src/shared/utils/api.ts` defaults local API traffic to `http://localhost:3002` |

The practical result is:

| Surface | Typical local URL |
|--------|-------------------|
| Frontend | `http://localhost:3001` |
| Backend API | `http://localhost:3002` |
| Swagger | `http://localhost:3002/docs` |

## Frontend Architecture

### Frontend Directory Model

| Area | Purpose |
|------|---------|
| `frontend/src/app` | Route tree, layouts, page entry points |
| `frontend/src/features` | Feature-local components, hooks, and API services |
| `frontend/src/shared` | Shared UI building blocks, hooks, and base utilities |

### App Router Structure

| Route | Purpose |
|------|---------|
| `/` | Landing page |
| `/login` | Demo sign-in page |
| `/audit` | Public audit form |
| `/dashboard` | Dashboard summary |
| `/dashboard/audits` | Audit list and drill-in routes |
| `/dashboard/keywords` | Keyword project workspace entry point |
| `/dashboard/content` | Content list and preview modal |
| `/dashboard/leads` | Lead list and lead drawer |

### Frontend Feature Areas

| Feature folder | Responsibility |
|---------------|----------------|
| `features/audit` | Audit form, pipeline visualization, audit polling, score cards |
| `features/dashboard` | High-level dashboard cards |
| `features/keywords` | Keyword workflow services and workflow UI components |
| `features/content` | Content API services and persisted preview payload typing |
| `features/leads` | Lead table, drawer UI, and lead mutation services |
| `shared/components` | Buttons, cards, status badges, avatars, breadcrumbs, etc. |
| `shared/utils/api.ts` | Shared typed fetch wrapper |

### Frontend Auth Model

Pulse is currently running a demo-mode frontend auth flow.

| Item | Current state |
|------|---------------|
| Auth provider | `frontend/src/shared/hooks/use-auth.tsx` |
| Storage mechanism | Browser `localStorage` key `pulse_auth` |
| Signed-in user | Static demo user |
| Route gate | Dashboard layout redirects unauthenticated users to `/login` |
| Middleware | Placeholder pass-through |

There is also evidence of a broader auth direction in the repo:

| Item | Meaning |
|------|---------|
| Backend docs mention Clerk | The long-term production auth model is Clerk-oriented |
| `users` table exists | User persistence is already part of the schema |
| `webhooks/clerk` module exists | Backend is prepared for Clerk webhook ingestion |
| Current UI remains demo-only | The dashboard currently authenticates locally rather than through a live identity provider |

### Frontend API Communication

All frontend API calls run through `apiFetch()`.

| Behavior | Description |
|---------|-------------|
| Base URL resolution | Prefers `API_URL` or `INTERNAL_API_URL`, then `NEXT_PUBLIC_API_URL`, then local fallback |
| Local fallback | Defaults to `http://localhost:3002` |
| Legacy URL normalization | Rewrites legacy `localhost:3005` local API settings to the current active local API port |
| Response model | Throws on non-OK responses, otherwise parses JSON |

Key API consumers on the frontend:

| Frontend service | Backend dependency | Why it matters |
|------------------|--------------------|----------------|
| `features/audit/services/audit.service.ts` | audit routes | Creates audits and polls progress |
| `features/keywords/services/keywords.service.ts` | keyword and workflow routes | Drives the strategist workflow shell |
| `features/content/services/content.service.ts` | `/content`, `/content/:id` | Powers the dashboard content table and preview modal |
| `features/leads/services/leads.service.ts` | `/leads`, `PATCH /leads/:id` | Powers lead list and lead drawer persistence |

## Backend Architecture

### Backend Directory Model

| Area | Purpose |
|------|---------|
| `server/src/main.ts` | App bootstrap, CORS, global validation pipe, Swagger |
| `server/src/app.module.ts` | Root module composition |
| `server/src/db` | Schema, DB client, seed script |
| `server/src/features` | Feature modules |
| `server/src/shared` | Shared backend modules and helpers |

### Bootstrap Responsibilities

| Concern | Behavior |
|--------|----------|
| CORS | Allows configured web origin plus local origins |
| Validation | Uses a global `ValidationPipe` with whitelist + transform |
| Swagger | Exposes `/docs` with bearer auth support configured |
| Port | Defaults to `3001` unless overridden by `PORT` |

### Backend Feature Modules

| Module | Responsibility |
|-------|----------------|
| `features/leads` | Lead capture and lead updates |
| `features/audit` | Audit storage, retrieval, and background processing orchestration |
| `features/keywords` | Projects, workflow runs, workflow artifacts, approvals, research promotion |
| `features/content` | Content listing, retrieval, and generation surfaces |
| `features/integrations` | Ahrefs, Serper, OpenAI, PageSpeed, scraper services |
| `features/webhooks` | Clerk webhook entry point |

### Backend Layering Pattern

| Layer | Purpose |
|------|---------|
| Controller | Route definitions and request/response boundaries |
| Service | Business logic and orchestration |
| DTO | Request validation and normalization |
| DB schema / client | Persistence model and query access |
| Queue processor / worker | Background execution where latency is too high for request/response |

## Database Model

### Current Core Tables

| Table | Owns |
|------|------|
| `users` | User identities synced from auth infrastructure |
| `leads` | Audit-submission lead records |
| `audits` | Raw audit output, scores, progress, pipeline state |
| `keyword_projects` | Dashboard keyword research projects |
| `topical_maps` | Pillar/cluster maps and target URL structure |
| `keywords` | Keyword ledger rows |
| `content_pieces` | Brief/article persistence |

### Workflow-Oriented Tables

| Table | Purpose |
|------|---------|
| `keyword_workflow_runs` | One guided workflow run per project/language/market |
| `keyword_workflow_artifacts` | Saved checkpoint payloads for each workflow step |
| `keyword_workflow_approvals` | Approval and revision decisions attached to checkpoints |
| `project_competitors` | Structured competitor roster |
| `project_competitor_metrics` | Structured metrics per competitor |
| `content_gap_imports` | Manual Ahrefs Content Gap imports |

### Important Enums

| Enum | Values |
|------|--------|
| `audit_status` | `pending`, `processing`, `complete`, `failed` |
| `lead_status` | `new`, `contacted`, `qualified`, `converted`, `lost` |
| `keyword_intent` | `transactional`, `commercial`, `informational`, `navigational` |
| `funnel_stage` | `tofu`, `mofu`, `bofu` |
| `keyword_status` | `discovered`, `approved`, `brief_ready`, `written`, `published` |
| `content_status` | `brief`, `draft`, `review`, `approved`, `published` |

### Workflow Enums

| Enum | Values |
|------|--------|
| `workflow_status` | `draft`, `running`, `awaiting_approval`, `revision_requested`, `approved`, `completed`, `failed`, `archived` |
| `workflow_step_key` | `business-profile`, `seed-keywords`, `serp-niche-map`, `competitor-buckets`, `competitor-metrics`, `phase1-baseline`, `method01-competitor-pages`, `method02-seed-expansion`, `method03-content-gap-import`, `consolidated-keywords`, `topical-map`, `content-brief`, `content-article` |
| `workflow_decision` | `approved`, `revision_requested`, `rejected` |

### Core Entity Relationships

```text
users -> audits
users -> keyword_projects
leads -> audits
keyword_projects -> keyword_workflow_runs
keyword_workflow_runs -> keyword_workflow_artifacts
keyword_workflow_artifacts -> keyword_workflow_approvals
keyword_projects -> project_competitors
project_competitors -> project_competitor_metrics
keyword_workflow_runs -> content_gap_imports
keyword_workflow_runs -> keywords
keyword_projects -> topical_maps
keywords -> content_pieces
```

### Relationship Meaning

| Connection | Why it exists |
|-----------|---------------|
| `leads -> audits` | Every public audit starts from a captured lead |
| `keyword_projects -> keyword_workflow_runs` | A project can have multiple guided workflow runs |
| `runs -> artifacts -> approvals` | Each strategist step is saved and then reviewed |
| `runs -> keywords` | Approved research can promote final keywords into the ledger |
| `projects -> topical_maps` | Approved topical planning is stored at project scope |
| `keywords -> content_pieces` | Approved keyword/topical decisions can materialize as content handoffs |

## API Surface Overview

### Health

| Method | Path | Purpose |
|------|------|---------|
| `GET` | `/health` | Service health check |

### Leads

| Method | Path | Purpose |
|------|------|---------|
| `POST` | `/leads` | Create lead and audit from the public form |
| `GET` | `/leads` | List leads for the dashboard |
| `GET` | `/leads/:id` | Retrieve a single lead |
| `PATCH` | `/leads/:id` | Update lead status and internal notes |

### Audits

| Method | Path | Purpose |
|------|------|---------|
| `GET` | `/audits/:id/status` | Poll audit progress |
| `GET` | `/audits` | List saved audits |
| `GET` | `/audits/:id` | Retrieve full audit output |

### Keywords

| Method | Path | Purpose |
|------|------|---------|
| `POST` | `/keywords/projects` | Create a keyword project |
| `GET` | `/keywords/projects` | List keyword projects |
| `GET` | `/keywords/projects/:id` | Get a project with related data |
| `GET` | `/keywords/projects/:id/keywords` | Get project keywords |
| `POST` | `/keywords/projects/:id/discover` | Trigger keyword discovery |
| `POST` | `/keywords/projects/:id/gap-analysis` | Trigger gap analysis |
| `POST` | `/keywords/projects/:id/workflows` | Create workflow run |
| `GET` | `/keywords/projects/:id/workflows/:workflowId` | Read workflow run, artifacts, approvals |
| `POST` | `/keywords/projects/:id/workflows/:workflowId/artifacts` | Save or update checkpoint artifact |
| Checkpoint decision routes | workflow decision endpoints | Approve, reject, or request revision |

### Content

| Method | Path | Purpose |
|------|------|---------|
| `GET` | `/content` | List content pieces |
| `GET` | `/content/:id` | Read persisted brief/article content detail |
| `POST` | `/content/generate-brief/:keywordId` | Queue brief generation |
| `POST` | `/content/generate-article/:keywordId` | Queue article generation |
| `PATCH` | `/content/:id/status` | Update content state |

### Webhooks

| Method | Path | Purpose |
|------|------|---------|
| `POST` | `/webhooks/clerk` | Clerk webhook ingestion |

## Queue Architecture

| Queue | Main jobs | Why it exists |
|------|-----------|---------------|
| `audit-queue` | Full audit pipeline | Audits require multiple slow network-bound steps |
| `keyword-queue` | Discovery, expansion, gap-analysis | Keyword collection and analysis can be expensive or iterative |
| `content-queue` | Brief generation, article generation | Content generation should not block user requests |

## Public Audit Lane

### End-to-End Flow

```text
Visitor
  -> /audit form
  -> POST /leads
  -> Create lead row
  -> Create audit row
  -> Enqueue audit job
  -> Poll GET /audits/:id/status
  -> Render live pipeline UI
  -> Render final scores/results
```

### Audit Pipeline Stages

| Step | Owner | What happens |
|------|-------|--------------|
| 01a | Scraper service | Homepage is scraped for content, structure, links, images, schema |
| 01b | OpenAI | AI-generated business profile and service-area understanding |
| 02 | OpenAI | Deep-read distillation of positioning and differentiation |
| 03 | PageSpeed | Performance analysis, potentially continuing in the background |
| 04 | Ahrefs + OpenAI | Keyword intelligence chain |
| 05 | Serper + OpenAI | SERP competitor discovery and classification |
| 06 | Ahrefs | Direct competitor metrics and top pages |
| 07 | Ahrefs | Organic competitor overlap analysis |
| 08 | Audit processor | Content gap analysis based on the persisted keyword pool and competitor data |
| 09+ | Future work | Scoring/report/email follow-up stages |

### Audit Data Strategy

| Data area | Persistence location |
|----------|----------------------|
| Progress state | `audits.currentStep`, progress metadata |
| Raw integration output | `audits.rawData` |
| PageSpeed completion mode | `rawData.pageSpeedStatus` |
| Keyword chain intermediates | `rawData.keywordSteps` |
| Competitor metrics | `rawData.competitorMetrics`, `rawData.organicCompetitorMetrics` |
| Content gap | `rawData.contentGap` |

### Why the Audit Lane Matters

| Reason | Explanation |
|-------|-------------|
| Acquisition | It is the top-of-funnel product entry point |
| Automation showcase | It demonstrates the platform's analysis capabilities without login |
| Lead creation | It generates both lead records and audit artifacts |
| Research input | It can inform later strategist work, even though it is not the final authority for approved keyword planning |

## Keyword Workspace Lane

### Strategic Goal

The dashboard keyword workflow is the controlled research system where strategists can author, review, revise, approve, and eventually promote research into durable downstream assets.

### Guided Workflow Steps

| Order | Step | Main output |
|------|------|-------------|
| 1 | Business profile | Brand, audience, offer, geography, initial seeds |
| 2 | Seed keywords | Approved seed list |
| 3 | SERP niche map | Market/topic map based on seed set |
| 4 | Competitor buckets | Direct vs organic competitor set |
| 5 | Competitor metrics | Structured competitor comparison |
| 6 | Phase 1 baseline | Existing winning pages, existing keywords, dedupe context |
| 7 | Method 01 | Competitor-page keyword candidates |
| 8 | Method 02 | Matching and related keyword expansions |
| 9 | Method 03 | Manual Content Gap import |
| 10 | Consolidation | Final keyword ledger with provenance |
| 11 | Topical map | Pillar/cluster structure |
| 12 | Content brief | Approved handoff payload for content |
| 13 | Content article | Approved handoff payload for article generation |

### Workflow Operating Rules

| Rule | Meaning |
|------|---------|
| Every step is a checkpoint | Work is persisted as artifacts rather than hidden local state |
| Every checkpoint can be reviewed | Approval, rejection, and revision are first-class states |
| Provenance is preserved | The final ledger should know which method and which artifacts supported each keyword |
| Topical maps come after approval | Content planning is downstream of reviewed research |
| Content handoff depends on workflow outputs | Content should start from approved topical context, not from a flat keyword alone |

### Current Keyword Workflow State

| Area | Current status |
|------|----------------|
| Backend schema foundation | Implemented |
| Workflow route foundation | Implemented |
| Project workspace and run history | Implemented |
| Workflow shell UI | Implemented |
| Step-aware authoring and checkpoint review | Implemented |
| Competitor capture and metrics | Implemented |
| Consolidation and topical map promotion | Implemented |
| Worker-driven generation for all steps | Still incomplete |
| Cross-run comparison UI | Pending |

### Keyword Promotion Connections

| Source step | Destination entity | Why |
|------------|--------------------|-----|
| `consolidated-keywords` approval | `keywords` | Promotes final reviewed keyword ledger into persistent research rows |
| `topical-map` approval | `topical_maps` | Promotes approved structure into durable topical planning |
| `topical-map` approval | `content-brief` queue entry | Opens the content handoff path |

## Content Lane

### Content Goal

The content system should consume approved strategist outputs and convert them into persisted brief/article state that can be reviewed in the dashboard.

### Content Boundary

| Stage | Required predecessor |
|------|----------------------|
| Brief generation | Approved topical map |
| Brief approval | Generated brief artifact |
| Article generation | Approved content brief |
| Article approval | Generated article artifact |

### Content Persistence Strategy

| Action | Persistence outcome |
|-------|---------------------|
| Approve `content-brief` | Upsert workflow-linked `content_pieces` row with brief payload |
| Approve `content-article` | Enrich the same content piece with article input metadata and draft status |
| Open dashboard content modal | Read `/content/:id` and render persisted payloads/body |

### Dashboard Content Preview Connection

| Frontend action | Backend dependency | Result |
|-----------------|--------------------|--------|
| Load content table | `GET /content` | Title, status, keyword/pillar context, created date |
| Open one content row | `GET /content/:id` | Persisted brief fields, article input metadata, internal link targets, stored body |
| Missing persisted detail | local fallback | Mock display only when no real detail payload exists |

### Content Gaps Still Open

| Gap | Meaning |
|----|---------|
| Queue is not fully workflow-aware yet | Structured approved artifacts are not yet the complete generation driver |
| Article body generation is incomplete | Metadata persists, but fully publishable body copy is not always stored |
| OpenAI content generation still needs deeper implementation | The generation surface is present, but the structured content engine remains incomplete |

## Leads Lane

### Lead Capture Flow

| Step | Result |
|------|--------|
| Visitor submits website, name, email, business description | Frontend calls `POST /leads` |
| Backend creates lead | `leads` row saved with `new` status |
| Backend creates audit | `audits` row linked to the lead |
| Backend enqueues audit job | Processing moves to `audit-queue` |
| Frontend starts polling | Audit progress UI begins |

### Lead Management Dashboard

| UI behavior | Backend behavior |
|------------|------------------|
| Lead drawer opens from list | Dashboard already has lead summary data |
| User edits status | Frontend prepares PATCH body |
| User edits notes | Notes are submitted as `notes` |
| Save is clicked | `PATCH /leads/:id` persists status and notes |
| Save succeeds | Drawer and list update with persisted lead |
| Save fails | Inline error is displayed |

### Lead Status Lifecycle

| Status | Meaning |
|------|---------|
| `new` | Fresh inbound lead |
| `contacted` | Follow-up has started |
| `qualified` | Lead passed qualification review |
| `converted` | Lead became a customer |
| `lost` | Lead did not convert |

## External Integrations

| Service | Used by | Main role |
|--------|---------|-----------|
| OpenAI | Audit, keywords, content | Profiling, classification, synthesis, content generation |
| Ahrefs | Audit, keywords | Domain metrics, top pages, keyword expansion, overlap/gap signals |
| Serper.dev | Audit | SERP discovery of ranking competitors |
| PageSpeed Insights | Audit | Core Web Vitals and performance signals |
| Local Lighthouse fallback | Audit | Resilience when PSI API fails |

### Ahrefs Usage

| Endpoint family | Why it is used |
|----------------|------------------|
| Site Explorer overview | Domain rating, traffic, backlinks |
| Top pages | Competitor page discovery |
| Keywords by traffic | Ranking keyword coverage |
| Keywords Explorer matching terms | Seed expansion |
| Content gap-related signals | Gap analysis inputs |

### PageSpeed Strategy

| Attempt order | Strategy |
|--------------|----------|
| 1 | PageSpeed Insights API |
| 2 | PSI retry |
| 3 | Local Lighthouse fallback |

The audit processor can continue beyond the initial PageSpeed wait window and resolve late PageSpeed data before the audit is finally marked complete.

### Integration Safeguards

| Safeguard | Purpose |
|----------|---------|
| Redis token bucket | Prevent quota exhaustion |
| Cached Ahrefs responses | Avoid unnecessary repeat calls |
| Graceful fallbacks | Keep the audit moving even when some providers are sparse or unavailable |
| Partial persistence | Preserve intermediate outputs for debugging and user feedback |

## End-to-End Connection Map

| Source | Target | Data passed | Why the connection matters |
|-------|--------|------------|----------------------------|
| Public audit form | `POST /leads` | Website and contact details | Converts anonymous visitors into leads and starts audit processing |
| Leads module | Audits module | Lead ID and audit record | Ensures every audit is tied to a captured lead |
| Audit processor | Integrations services | Scrape inputs, domain, keyword seeds | Enriches audits with external intelligence |
| Keyword workflow shell | Workflow artifact API | Step payloads and review decisions | Gives strategists controlled persistence and approvals |
| Workflow approvals | `keywords` / `topical_maps` / `content_pieces` | Approved research outputs | Converts reviewed workflow artifacts into durable downstream assets |
| Content dashboard | Content API | List and detail fetches | Lets strategists inspect persisted content handoffs |
| Leads dashboard | Leads API | Status and note updates | Turns lead list into an operational CRM-like review surface |

## Current Implementation Shape

Pulse is best understood as a hybrid system today.

| Area | State |
|------|-------|
| Public audit pipeline | Mature and highly automated |
| Dashboard audits review | Implemented |
| Dashboard leads management | Implemented |
| Keyword strategist workflow | Broadly implemented, still evolving |
| Content handoff persistence | Implemented |
| Full content generation engine | Partially implemented |
| Production-grade auth | Partially scaffolded, currently demo-mode in UI |

## What Is Stable Versus In Flight

| Stable enough to rely on | Still changing |
|--------------------------|----------------|
| Lead capture -> audit creation | Full worker-driven workflow generation coverage |
| Audit queue and live-progress pipeline | Cross-run keyword workflow comparison |
| Lead status lifecycle | Final structured content generation depth |
| Dashboard lead drawer persistence | Production auth rollout |
| Workflow artifact persistence and approvals | Some workflow steps still need deeper automation coverage |
| Final content/dashboard preview persistence | Some content records still persist metadata before full publishable body output |

## How To Read The Codebase Quickly

| If you want to understand... | Start here |
|-----------------------------|-----------|
| App bootstrap and runtime defaults | `server/src/main.ts`, `frontend/src/shared/utils/api.ts` |
| Public audit entry flow | `frontend/src/features/audit`, `server/src/features/leads`, `server/src/features/audit` |
| Keyword strategist workflow | `frontend/src/app/dashboard/keywords/[projectId]/workflows/[workflowId]/page.tsx`, `server/src/features/keywords` |
| Content preview and persistence | `frontend/src/app/dashboard/content/page.tsx`, `frontend/src/features/content/services/content.service.ts`, `server/src/features/content` |
| Lead review UI | `frontend/src/features/leads/components/leads-list.tsx`, `server/src/features/leads` |
| Persistence model | `server/src/db/schema.ts` and the docs in `docs/architecture/data-models.md` |

## Glossary

| Term | Meaning |
|------|---------|
| Audit | Automated website diagnostic record created from the public lead form |
| Keyword project | Container for strategist-led keyword work |
| Workflow run | One guided research run for a project/language/market |
| Artifact | Saved checkpoint payload for one workflow step |
| Approval | Human decision attached to an artifact |
| Topical map | Approved pillar/cluster and URL planning structure |
| Content piece | Persisted brief/article object created from approved workflow outputs |

## Bottom Line

Pulse is not one monolithic SEO tool. It is a connected operating system with two linked lanes:

| Lane | Core role |
|------|-----------|
| Public audit | Acquire leads and produce automated diagnostic intelligence |
| Dashboard workflow | Convert research and human approvals into durable keyword, topical, and content assets |

The central architectural idea is that reviewed workflow artifacts should progressively become the trusted source of truth for downstream planning and content, while the public audit remains the fast, automated acquisition engine.