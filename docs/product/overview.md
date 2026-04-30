# Product Overview

## What is Calibrate Commerce?

Multi-tenant SaaS product for automated SEO/GEO/AEO auditing and organic visibility growth.

## Two Surfaces

1. **Public lead magnet** — free personalised audit report (no login required)
2. **Authenticated workspace** — keyword research, topical maps, content engine, CMS publishing

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

## Local URLs

| App | URL |
|-----|-----|
| Web (Next.js) | http://localhost:3000 |
| API (NestJS) | http://localhost:3001 |
| API Docs (Swagger) | http://localhost:3001/docs |

## Environment Variables

Copy `.env.example` → `.env` and fill in your keys. See [Infrastructure](../architecture/system-design.md) for full list.
