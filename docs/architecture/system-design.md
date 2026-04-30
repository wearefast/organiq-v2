# System Design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), Tailwind CSS |
| Auth | Clerk (JWT, webhooks, orgs) |
| API | NestJS 10 (REST) |
| ORM | Drizzle ORM + PostgreSQL |
| Queue | BullMQ + Redis |
| External | Ahrefs, SerpAPI, OpenAI, PageSpeed |

## Repository Structure

```
calibrate-commerce/
├── frontend/           # Next.js 15 — App Router, Clerk, Tailwind
│   └── src/
│       ├── app/        # Next.js pages & layouts
│       ├── features/   # Feature modules
│       └── shared/     # Shared components, hooks, utils
├── server/             # NestJS API + BullMQ workers
│   └── src/
│       ├── db/         # Drizzle schema, client, seed
│       ├── features/   # Feature modules
│       └── shared/     # Database module, health, types
├── docs/               # All documentation
├── infra/              # Docker Compose, local dev infra
└── .github/            # Copilot instructions
```

## Local Infrastructure

```bash
npm run infra:up       # Start Postgres + Redis
npm run infra:down     # Stop
```

| Service | Port | Credentials |
|---------|------|-------------|
| PostgreSQL | 5432 | calibrate / calibrate / calibrate_commerce |
| Redis | 6379 | No auth |

## Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_HOST` | Yes | Default: localhost |
| `REDIS_PORT` | Yes | Default: 6379 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | From Clerk dashboard |
| `CLERK_SECRET_KEY` | Yes | From Clerk dashboard |
| `AHREFS_API_KEY` | Phase 1 | Ahrefs v3 API key |
| `SERPAPI_KEY` | Phase 1 | SerpAPI key |
| `OPENAI_API_KEY` | Phase 1 | OpenAI API key |
| `PAGESPEED_API_KEY` | Phase 1 | Google PageSpeed key |
