# Pulse OS

Agent-led SEO/GEO/AEO strategy consultant operating system for agencies.

**17-step guided workflow** from discovery through content production, powered by AI agents with human-in-the-loop approval at every checkpoint.

## Documentation

| Category | Document | Description |
|----------|----------|-------------|
| Planning | [Implementation Plan](docs/implementation-plan.md) | Master task checklist |
| Planning | [Technical Debt](docs/technical-debt.md) | Deferred work tracker |
| Product | [Project Handbook](docs/project-handbook.md) | Full product reference |
| Architecture | [System Design](docs/architecture/system-design.md) | Tech stack, topology |
| Architecture | [Frontend](docs/architecture/frontend-architecture.md) | Next.js structure |
| Architecture | [Backend](docs/architecture/backend-architecture.md) | NestJS modules, agents |
| Architecture | [Data Models](docs/architecture/data-models.md) | Drizzle schema |
| Debugging | [Known Issues](docs/debugging/known-issues.md) | Tracked issues |
| Decisions | [Tech Decisions](docs/decisions/tech-decisions.md) | Architecture choices |

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
