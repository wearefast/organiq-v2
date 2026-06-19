# System Design — Pulse OS

## Overview

Pulse OS is an agent-led SEO/GEO/AEO strategy operating system. It runs an 18-step guided workflow where AI agents execute research and analysis tasks, and human strategists approve outputs at every checkpoint before data flows downstream.

## Architecture Principles

1. **Agent-led, human-approved** — AI does the work, humans validate
2. **Deterministic orchestration** — BullMQ + NestJS handles step sequencing, not LLMs
3. **No AI frameworks** — Custom managed agent runtime (Anthropic), no LangChain/AutoGen
4. **Tool sandboxing** — Each agent only accesses its declared tools
5. **Credit-metered** — Every operation has a cost; pre-check before execution
6. **Multi-tenant** — Organization → Workspace → Project → Run hierarchy

## Runtime Topology

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  Next.js 15 (App Router, Clerk, Zustand)                │
└──────────────┬───────────────────────────┬──────────────┘
               │ REST (fetch)              │ WebSocket
               ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│  NestJS 10 API                                           │
│  ├── Controllers (REST)                                  │
│  ├── WebSocket Gateway (real-time step progress)         │
│  ├── Agent Runtime (execution loop)                      │
│  ├── Workflow Service (orchestration)                     │
│  ├── BullMQ Worker (step processor)                      │
│  └── @nestjs/schedule (retention cron, scheduler)        │
└──────┬────────────┬────────────┬────────────────────────┘
       │            │            │
       ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐
│PostgreSQL│ │  Redis   │ │  External Services            │
│  16      │ │  7       │ │  ├── OpenAI (function calling)│
│          │ │  (BullMQ)│ │  ├── Anthropic (Claude)       │
│  pulse_v2│ │          │ │  ├── Ahrefs v3 (3 APIs)      │
└──────────┘ └──────────┘ │  ├── DataForSEO (9 modules)   │
                           │  ├── Firecrawl               │
                           │  ├── Serper.dev              │
                           │  ├── PageSpeed / CrUX        │
                           │  └── Stripe (billing)        │
                           └──────────────────────────────┘
```

## Service Ports

### Production

| Surface | URL / Port | Notes |
|---------|------------|-------|
| Frontend | https://app.rankorganiq.com | Vercel |
| Backend API | https://api.rankorganiq.com | EC2 → nginx → :3002 |
| Backend (internal) | :3002 | NestJS inside Docker |
| PostgreSQL | RDS private endpoint | Accessible from EC2 only |
| Redis | ElastiCache private endpoint (TLS) | Accessible from EC2 only |

### Local Development

| Service | Port | Notes |
|---------|------|-------|
| Frontend | 3001 | Next.js dev server |
| Backend API | 3002 | NestJS dev server |
| PostgreSQL | 5433 | Docker Compose |
| Redis | 6379 | Docker Compose |

## Infrastructure

### Production (AWS + Vercel)

| Layer | Service | Config |
|-------|---------|--------|
| Frontend | Vercel | Next.js, auto-deploy on `main` push |
| Backend | EC2 t3.small + Docker | `organiq-server` container, nginx SSL |
| Database | RDS PostgreSQL 16 | `pulse-postgres`, private subnet |
| Cache/Queue | ElastiCache Redis 7 | `pulse-redis`, TLS, private subnet |
| Image registry | ECR `organiq-server-prod` | `ap-southeast-1` |

### Local Development (Docker Compose)

| Container | Image | Volume |
|-----------|-------|--------|
| `pulse_v2_postgres` | postgres:16-alpine | `pulse_v2_postgres_data` |
| `pulse_v2_redis` | redis:7-alpine | `pulse_v2_redis_data` |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| No LangChain | Too much abstraction; need full control over token usage and tool calls |
| Drizzle over Prisma | Better TypeScript inference, no binary engine issues on Windows |
| BullMQ for steps | Reliable retry, dead letter, priority; already battle-tested in v1 |
| Clerk for auth | Handles MFA, org management, webhooks; reduces auth surface area |
| WebSocket for progress | Steps can take 30-60s; polling is wasteful |
| Credit pre-check | Prevents runaway costs; agents cannot exceed budget |
| pdfmake for PDFs | Server-side PDF generation without external sidecar dependency |
| Stripe for billing | Subscription + one-time payments, customer portal, webhook-driven |
| @nestjs/schedule | Native cron for retention/cleanup tasks without extra infra |
