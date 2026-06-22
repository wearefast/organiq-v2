# Pulse OS

Agent-led SEO/GEO/AEO strategy consultant operating system for agencies.

**18-step guided workflow** from discovery through content production, powered by AI agents with human-in-the-loop approval at every checkpoint.

## Documentation

| Category | Document | Description |
|----------|----------|-------------|
| **Product** | [Product Overview](docs/product/overview.md) | What Pulse is, who it's for, 18-step workflow, key concepts |
| **Product** | [Project Handbook](docs/project-handbook.md) | Full product reference & dev guide |
| **Architecture** | [System Design](docs/architecture/system-design.md) | Runtime topology, service ports, design principles |
| **Architecture** | [Frontend](docs/architecture/frontend-architecture.md) | Next.js 15 App Router, feature modules, design tokens |
| **Architecture** | [Backend](docs/architecture/backend-architecture.md) | NestJS modules, agent runtime, workflow orchestration |
| **Architecture** | [Data Models](docs/architecture/data-models.md) | Drizzle schema, ERD, 31 tables |
| **Architecture** | [API Reference](docs/architecture/api-reference.md) | Complete REST API surface (all endpoints) |
| **Architecture** | [Dependencies](docs/architecture/dependencies.md) | All packages, external services, env variables |
| **Features** | [Workflows](docs/features/workflows.md) | 18-step agent pipeline, step states, dependency graph |
| **Features** | [Keywords](docs/features/keywords.md) | Keyword lifecycle, intent, funnel stages |
| **Features** | [Content](docs/features/content.md) | Briefs, articles, scoring framework |
| **Features** | [Reports](docs/features/reports.md) | PDF generation, templates, download flow |
| **Features** | [Topical Maps](docs/features/topical-maps.md) | Pillar → cluster → keyword hierarchy |
| **Features** | [Integrations](docs/features/integrations.md) | All 9 external services, retry logic, tool registry |
| **Features** | [Auth & Orgs](docs/features/auth.md) | Clerk SSO, guards, security hardening |
| **Features** | [Credits](docs/features/credits.md) | Credit system, ledger, debit flow, workspace limits |
| **Features** | [Billing](docs/features/billing.md) | Stripe subscriptions, credit packs, customer portal |
| **Features** | [User Management](docs/features/user-management.md) | Members, invitations, access grants, workspace credit caps |
| **Features** | [Audit](docs/features/audit.md) | Site audit (workflow step) + LLM audit overview |
| **Features** | [LLM Crawlability Audit](docs/features/llm-crawlability-audit.md) | Standalone AI bot indexability audit — scoring, checks, API, UI |
| **Features** | [LLM Traffic](docs/features/llm-traffic.md) | AI engine traffic tracking and analytics |
| **Features** | [Notifications](docs/features/notifications.md) | Decay alerts, workflow events, in-app notifications |
| **Features** | [On-Demand Agents](docs/features/on-demand-agents.md) | Ad-hoc agent execution outside workflow |
| **Features** | [Scheduled Workflows](docs/features/scheduled-workflows.md) | Cron-based recurring agent execution with delivery |
| **Features** | [Prompt Visibility](docs/features/prompt-visibility.md) | AI search prompt tracking and visibility checks |
| **Changelog** | [Changelog](docs/changelog.md) | All fixes and updates with details |
| **Planning** | [Implementation Plan](docs/implementation-plan.md) | Master task checklist (90 tasks, all complete) |
| **Planning** | [Roadmap](docs/roadmap.md) | Product backlog and pending features |
| **Planning** | [Technical Debt](docs/technical-debt.md) | Deferred work tracker (21 items, 5 resolved) |
| **Debugging** | [Known Issues](docs/debugging/known-issues.md) | Tracked issues and resolutions |
| **Debugging** | [Debugging Patterns](docs/debugging/patterns.md) | Debugging strategies and lessons learned |
| **Decisions** | [Architecture Decisions v3](docs/decisions/architecture-decisions-v3.md) | 13 locked decisions (AD-1 through AD-13) |
| **Decisions** | [Tech Decisions](docs/decisions/tech-decisions.md) | Architecture choices and rationale |
| **Decisions** | [Engineering Process](docs/decisions/engineering-process.md) | 7-step workflow, anti-patterns |
| **Security** | [Audit Action Plan](docs/audit-action-plan.md) | Security audit findings, score, remediation status |
| **Audit** | [Architecture Snapshot](audit/architecture.md) | System state, topology, versioned tech stack |
| **Audit** | [Agent Flow](audit/agent-flow.md) | Per-step execution model, context chains, API calls |
| **Audit** | [Prompt Audit](audit/prompt-audit.md) | All prompts — execution model, tool availability, anti-hallucination status |
| **Audit** | [Tool Audit](audit/tool-audit.md) | Registered tools, agent access, credit costs |
| **Audit** | [Frontend Contracts](audit/frontend-contracts.md) | Component → API, WebSocket events, type gaps |
| **Audit** | [Performance](audit/performance.md) | API call inventory, credit costs per run, bottlenecks |
| **Audit** | [Final Report](audit/final-report.md) | Audit findings log, decisions, open items |

## Production

| Surface | URL |
|---------|-----|
| Frontend | https://app.rankorganiq.com |
| Backend API | https://api.rankorganiq.com |
| API Docs | https://api.rankorganiq.com/docs |

**Deployments are automatic:**
- **Frontend**: push to `main` → Vercel builds and deploys
- **Backend**: push to `main` touching `server/**` → GitHub Actions builds Docker image → pushes to ECR → SSHes to EC2 → runs migrations → hot-swaps container

See [Infrastructure](docs/infrastructure.md) for full operational reference.

## Local Development

```bash
# 1. Clone and install
npm run install:all

# 2. Start infrastructure (Postgres + Redis via Docker Compose)
npm run infra:up

# 3. Push schema to database
npm run db:push

# 4. Seed development data
npm run db:seed

# 5. Start dev servers
npm run dev
```

| Local Service | URL |
|---------------|-----|
| Frontend (Next.js) | http://localhost:3001 |
| Backend API (NestJS) | http://localhost:3002 |
| API Docs (Swagger) | http://localhost:3002/docs |
| Drizzle Studio | `npm run db:studio` |

## Infrastructure (Production — AWS + Vercel)

| Service | Config | Purpose |
|---------|--------|---------|
| Vercel | Next.js (auto-deploy on `main`) | Frontend hosting |
| EC2 t3.small | `ap-southeast-1`, Docker + nginx | Backend (NestJS) |
| RDS PostgreSQL 16 | db.t3.micro, private subnet | Primary database |
| ElastiCache Redis 7 | cache.t4g.micro, TLS | BullMQ queues |
| ECR | `organiq-server-prod` | Docker image registry |

**Local dev only** (Docker Compose, `infra/docker-compose.yml`):

| Container | Image | Port |
|-----------|-------|------|
| `pulse_v2_postgres` | postgres:16-alpine | 5433 |
| `pulse_v2_redis` | redis:7-alpine | 6379 |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, Zustand, Clerk |
| Backend | NestJS 10, Drizzle ORM, BullMQ, Redis |
| Database | PostgreSQL 16 |
| AI/Agents | Anthropic Claude (primary), OpenAI (image generation), custom agent runtime |
| Integrations | Ahrefs v3, DataForSEO, Firecrawl, Serper.dev, PageSpeed/CrUX, Google Search Console |
| PDF | pdfmake (in-process, no sidecar) |

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys.
