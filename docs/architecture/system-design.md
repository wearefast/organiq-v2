# System Design — Pulse OS

## Overview

Pulse OS is an agent-led SEO/GEO/AEO strategy operating system. It runs a 17-step guided workflow where AI agents execute research and analysis tasks, and human strategists approve outputs at every checkpoint before data flows downstream.

## Architecture Principles

1. **Agent-led, human-approved** — AI does the work, humans validate
2. **Deterministic orchestration** — BullMQ + NestJS handles step sequencing, not LLMs
3. **No AI frameworks** — Custom ~200-line execution loop, no LangChain/AutoGen
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
│  └── BullMQ Worker (step processor)                      │
└──────┬────────────┬────────────┬────────────────────────┘
       │            │            │
       ▼            ▼            ▼
┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐
│PostgreSQL│ │  Redis   │ │  External Services            │
│  16      │ │  7       │ │  ├── OpenAI (function calling)│
│          │ │  (BullMQ)│ │  ├── Ahrefs v3 (3 APIs)      │
│  pulse_v2│ │          │ │  ├── DataForSEO (9 modules)   │
└──────────┘ └──────────┘ │  ├── Firecrawl               │
                           │  ├── Serper.dev              │
                           │  ├── PageSpeed / CrUX        │
                           │  └── Python Sidecar (FastAPI) │
                           └──────────────────────────────┘
```

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3001 | Next.js dev server |
| Backend API | 3002 | NestJS REST + WebSocket |
| Python Sidecar | 8000 | Analysis + PDF |
| PostgreSQL | 5433 | Database |
| Redis | 6379 | BullMQ queues |

## Infrastructure (Docker Compose)

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
| Python sidecar | ReportLab + NLP libraries are Python-native; FastAPI is lightweight |
| WebSocket for progress | Steps can take 30-60s; polling is wasteful |
| Credit pre-check | Prevents runaway costs; agents cannot exceed budget |
