# Dependencies & Integrations

## Runtime Dependencies

### Backend (server/)

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | ^10.3.0 | Core NestJS framework |
| `@nestjs/core` | ^10.3.0 | NestJS dependency injection & lifecycle |
| `@nestjs/config` | ^3.2.0 | Environment variable management via `ConfigService` |
| `@nestjs/platform-express` | ^10.3.0 | Express HTTP adapter |
| `@nestjs/platform-socket.io` | ^10.3.0 | WebSocket gateway (Socket.IO) for real-time step progress |
| `@nestjs/websockets` | ^10.3.0 | WebSocket decorators & module |
| `@nestjs/swagger` | ^7.3.0 | API documentation (Swagger UI at `/docs`) |
| `@nestjs/bullmq` | ^10.1.0 | Queue integration for BullMQ job processing |
| `bullmq` | ^5.7.0 | Redis-backed job queue (workflow step execution) |
| `drizzle-orm` | ^0.36.0 | Type-safe SQL ORM (PostgreSQL) |
| `pg` | ^8.12.0 | PostgreSQL client driver |
| `ioredis` | ^5.4.0 | Redis client for BullMQ |
| `openai` | ^6.35.0 | OpenAI API client (GPT-4o function calling) |
| `jose` | ^6.2.3 | JWT verification for Clerk tokens |
| `class-validator` | ^0.14.4 | DTO validation decorators |
| `class-transformer` | ^0.5.1 | Object transformation for DTOs |
| `cheerio` | ^1.2.0 | HTML parsing (site audit, scraping) |
| `chrome-launcher` | ^1.2.1 | Headless Chrome for Lighthouse |
| `lighthouse` | ^13.1.0 | Performance auditing (PageSpeed) |
| `rxjs` | ^7.8.1 | Reactive programming (NestJS internals) |
| `reflect-metadata` | ^0.2.2 | TypeScript decorator metadata |

### Frontend (frontend/)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.5.15 | React framework (App Router, SSR) |
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | React DOM renderer |
| `@clerk/nextjs` | ^7.3.3 | Authentication (SSO, org management) |
| `@react-pdf/renderer` | ^4.5.1 | Client-side PDF rendering |
| `lucide-react` | ^1.11.0 | Icon library |
| `class-variance-authority` | ^0.7.0 | Component variant utility |
| `clsx` | ^2.1.1 | Conditional CSS class merging |
| `tailwind-merge` | ^2.3.0 | Tailwind class conflict resolution |
| `socket.io-client` | ^4.8.3 | WebSocket client for real-time step updates |

### Root (monorepo)

| Package | Version | Purpose |
|---------|---------|---------|
| `concurrently` | ^8.2.2 | Parallel script execution (`npm run dev`) |
| `prettier` | ^3.2.5 | Code formatting |

---

## Dev Dependencies

### Backend

| Package | Purpose |
|---------|---------|
| `@nestjs/cli` | NestJS CLI (build, generate) |
| `@nestjs/schematics` | Code generation templates |
| `drizzle-kit` | Schema migrations & studio |
| `tsx` | TypeScript execution (seed scripts) |
| `typescript` ^5.4.0 | TypeScript compiler |

### Frontend

| Package | Purpose |
|---------|---------|
| `tailwindcss` ^3.4.3 | Utility-first CSS |
| `postcss` ^8.4.38 | CSS processing |
| `autoprefixer` | Vendor prefix automation |
| `typescript` ^5.4.0 | TypeScript compiler |

---

## External Service Integrations

### API Providers

| Service | Env Variable | Purpose | Auth Method |
|---------|-------------|---------|-------------|
| **OpenAI** | `OPENAI_API_KEY` | Agent LLM (GPT-4o function calling) | Bearer token |
| **Ahrefs v3** | `AHREFS_API_KEY` | Domain rating, organic keywords, backlinks, competing domains | Bearer token |
| **DataForSEO** | `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | SERP results, keyword volume, on-page audit, backlinks | Basic auth |
| **Serper.dev** | `SERPER_API_KEY` | Google SERP results (search, news, images) | X-API-KEY header |
| **Firecrawl** | `FIRECRAWL_API_KEY` | Web scraping and crawling (markdown output) | Bearer token |
| **PageSpeed Insights** | `PAGESPEED_API_KEY` (optional) | Core Web Vitals, performance scoring | Query param |
| **CrUX API** | `PAGESPEED_API_KEY` | Chrome UX Report real-user metrics | Query param |
| **Google Search Console** | GSC API | Search performance, top queries/pages | OAuth |

### Infrastructure Services

| Service | Env Variable | Default | Purpose |
|---------|-------------|---------|---------|
| **PostgreSQL 16** | `DATABASE_URL` | `postgres://pulse:pulse@localhost:5433/pulse_v2` | Primary data store |
| **Redis 7** | `REDIS_URL` | `redis://localhost:6379` | BullMQ job queues |
| **Clerk** | `CLERK_SECRET_KEY` / `CLERK_WEBHOOK_SECRET` | — | Auth provider (JWT, webhooks) |
| **Stripe** | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | — | Billing & subscriptions |

---

## Environment Variables

### Required

| Variable | Used By | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Server | PostgreSQL connection string |
| `REDIS_URL` | Server | Redis connection string |
| `CLERK_SECRET_KEY` | Server | Clerk backend API key |
| `CLERK_WEBHOOK_SECRET` | Server | Svix webhook verification secret |
| `OPENAI_API_KEY` | Server | OpenAI API key for agent runtime |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `AHREFS_API_KEY` | `''` | Ahrefs v3 API key |
| `SERPER_API_KEY` | `''` | Serper.dev API key |
| `FIRECRAWL_API_KEY` | `''` | Firecrawl API key |
| `DATAFORSEO_LOGIN` | `''` | DataForSEO login |
| `DATAFORSEO_PASSWORD` | `''` | DataForSEO password |
| `PAGESPEED_API_KEY` | `''` | Google PageSpeed/CrUX API key |
| `STRIPE_SECRET_KEY` | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |
| `FRONTEND_URL` | — | Frontend origin (CORS) |
| `PORT` | `3002` | Backend server port |
| `CLERK_DOMAIN` | — | Custom Clerk domain |

### Frontend (via `NEXT_PUBLIC_*`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk sign-in redirect |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk sign-up redirect |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Post-login redirect |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Post-signup redirect |

---

## Retry & Resilience

All external API integrations use the shared `withRetry()` utility (`server/src/shared/utils/retry.ts`):

- **Default**: 3 attempts, exponential backoff (1s → 2s → 4s)
- **Applies to**: Ahrefs, DataForSEO, Serper, Firecrawl, PageSpeed, CrUX, GSC sidecar calls
- **OpenAI**: Has its own retry logic in `openai.service.ts` for 429/5xx responses
- **Not retried**: Clerk webhook processing (idempotent via `onConflictDoNothing`)
