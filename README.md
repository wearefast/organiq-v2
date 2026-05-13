# Pulse OS

Agent-led SEO/GEO/AEO strategy consultant operating system for agencies.

**17-step guided workflow** from discovery through content production, powered by AI agents with human-in-the-loop approval at every checkpoint.

## Documentation

| Category | Document | Description |
|----------|----------|-------------|
| **Product** | [Product Overview](docs/product/overview.md) | What Pulse is, who it's for, 17-step workflow, key concepts |
| **Product** | [Project Handbook](docs/project-handbook.md) | Full product reference & dev guide |
| **Architecture** | [System Design](docs/architecture/system-design.md) | Runtime topology, service ports, design principles |
| **Architecture** | [Frontend](docs/architecture/frontend-architecture.md) | Next.js 15 App Router, feature modules, design tokens |
| **Architecture** | [Backend](docs/architecture/backend-architecture.md) | NestJS modules, agent runtime, workflow orchestration |
| **Architecture** | [Data Models](docs/architecture/data-models.md) | Drizzle schema, ERD, 14 core tables |
| **Architecture** | [API Reference](docs/architecture/api-reference.md) | Complete REST API surface (all endpoints) |
| **Architecture** | [Dependencies](docs/architecture/dependencies.md) | All packages, external services, env variables |
| **Features** | [Workflows](docs/features/workflows.md) | 17-step agent pipeline, step states, dependency graph |
| **Features** | [Keywords](docs/features/keywords.md) | Keyword lifecycle, intent, funnel stages |
| **Features** | [Content](docs/features/content.md) | Briefs, articles, scoring framework |
| **Features** | [Reports](docs/features/reports.md) | PDF generation, templates, download flow |
| **Features** | [Topical Maps](docs/features/topical-maps.md) | Pillar → cluster → keyword hierarchy |
| **Features** | [Integrations](docs/features/integrations.md) | All 8 external services, retry logic, tool registry |
| **Features** | [Auth & Orgs](docs/features/auth.md) | Clerk SSO, webhooks, idempotency |
| **Features** | [Credits](docs/features/credits.md) | Credit system, ledger, debit flow |
| **Changelog** | [Changelog](docs/changelog.md) | All fixes and updates with details |
| **Planning** | [Implementation Plan](docs/implementation-plan.md) | Master task checklist (90 tasks, all complete) |
| **Planning** | [Technical Debt](docs/technical-debt.md) | Deferred work tracker |
| **Debugging** | [Known Issues](docs/debugging/known-issues.md) | Tracked issues and resolutions |
| **Debugging** | [Debugging Patterns](docs/debugging/patterns.md) | Debugging strategies and lessons learned |
| **Debugging** | [Phase A-C Audit](docs/debugging/phase-abc-audit.md) | Comprehensive codebase audit findings |
| **Decisions** | [Tech Decisions](docs/decisions/tech-decisions.md) | Architecture choices and rationale |
| **Decisions** | [Engineering Process](docs/decisions/engineering-process.md) | 7-step workflow, anti-patterns |

## Quick Start

```bash
# 1. Clone and install
npm run install:all

# 2. Start infrastructure (Postgres + Redis)
npm run infra:up

# 3. Push schema to database
npm run db:push

# 4. Seed development data
npm run db:seed

# 5. Start dev servers
npm run dev
```

## Local Services

| Service | URL |
|---------|-----|
| Frontend (Next.js) | http://localhost:3001 |
| Backend API (NestJS) | http://localhost:3002 |
| API Docs (Swagger) | http://localhost:3002/docs |
| Python Sidecar | http://localhost:8000 |
| Drizzle Studio | `npm run db:studio` |

## Infrastructure

| Service | Image | Port | DB/Details |
|---------|-------|------|------------|
| PostgreSQL | postgres:16-alpine | 5433 | `pulse_v2` / user: `pulse` |
| Redis | redis:7-alpine | 6379 | BullMQ queues |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Zustand, Clerk |
| Backend | NestJS 10, Drizzle ORM, BullMQ, Redis |
| Database | PostgreSQL 16 |
| AI/Agents | OpenAI (function calling), custom runtime (~200 LOC) |
| Integrations | Ahrefs v3, DataForSEO, Firecrawl, Serper.dev, PageSpeed/CrUX |
| Python Sidecar | FastAPI, ReportLab (PDF), 12 analysis endpoints |

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys.
