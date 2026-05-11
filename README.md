# Calibrate Commerce

Multi-tenant SaaS product for automated SEO/GEO/AEO auditing and organic visibility growth.

**Two surfaces:**
1. **Public lead magnet** — free personalised audit report (no login)
2. **Authenticated workspace** — keyword research, topical maps, content engine, CMS publishing

## Documentation

| Category | Document | Description |
|----------|----------|-------------|
| Product | [Project Handbook](docs/project-handbook.md) | Single-file deep dive into the full product, architecture, flows, and integrations |
| Product | [Overview](docs/product/overview.md) | Product description, quick start |
| Product | [Features](docs/product/features.md) | Feature modules & conventions |
| Product | [User Flows](docs/product/user-flows.md) | End-to-end user journeys |
| Architecture | [System Design](docs/architecture/system-design.md) | Tech stack, repo structure, env vars |
| Architecture | [Frontend](docs/architecture/frontend-architecture.md) | Next.js routing, auth, API layer |
| Architecture | [Backend](docs/architecture/backend-architecture.md) | NestJS modules, API endpoints, queues |
| Architecture | [Data Models](docs/architecture/data-models.md) | Drizzle schema, tables, relationships |
| Features | [Audit](docs/features/audit.md) | Audit pipeline steps & scoring |
| Features | [Keywords](docs/features/keywords.md) | Keyword research pipeline |
| Features | [Content](docs/features/content.md) | Content engine workflow |
| Features | [Leads](docs/features/leads.md) | Lead capture flow |
| Features | [Integrations](docs/features/integrations.md) | External APIs & webhooks |
| Debugging | [Known Issues](docs/debugging/known-issues.md) | Tracked issues |
| Debugging | [Patterns](docs/debugging/patterns.md) | Debugging rules & patterns |
| Decisions | [Tech Decisions](docs/decisions/tech-decisions.md) | Architecture & tooling choices |

## Quick Start

```bash
# 1. Clone and install
npm run install:all

# 2. Start local services (Postgres + Redis)
npm run infra:up

# 3. Push Drizzle schema to database
npm run db:push

# 4. Seed database (optional)
npm run db:seed

# 5. Start frontend + server in dev mode
npm run dev
```

| App | URL |
|-----|-----|
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys. See [Infrastructure docs](docs/infrastructure.md) for details.
