# Calibrate Commerce — Organic Visibility Engine
## Master Build Plan + GitHub Copilot Prompt

---

## 1. What You're Building

A **multi-tenant SaaS product** with two distinct surfaces:

1. **Public lead magnet** — anyone enters their URL and business details, gets a free personalised audit report (SEO + GEO + AEO) emailed within minutes. No login required. Every submission = qualified lead.
2. **Authenticated workspace** — paying clients log in to access their full keyword research pipeline, topical map builder, content generation engine, and CMS publishing queue.

---

## 2. Product Modules

### Module 1 — Audit Engine (Lead Magnet)
- Public-facing page: URL + name + work email + basic business info
- Async pipeline triggered on submission:
  1. Scrape the submitted URL (Cheerio / Playwright)
  2. Extract content, meta, schema, Core Web Vitals via PageSpeed Insights API
  3. Run AI business profile (Claude) — extracts brand, target market, services, geography
  4. Identify 5–10 seed keywords from the business profile
  5. Pull domain metrics via Ahrefs API (DR, traffic, keywords, backlinks)
  6. Identify 3–5 SERP competitors via SerpAPI
  7. Pull competitor metrics via Ahrefs
  8. Run Content Gap analysis (keywords competitors rank for, client doesn't)
  9. Score across 4 dimensions: Technical SEO, Content Coverage, Backlink Authority, AEO/GEO Readiness
  10. Generate personalised PDF report via Claude + Puppeteer
  11. Send report to work email via Resend
  12. Store lead in DB with full context

### Module 2 — Keyword Research Pipeline (Dashboard)
Digitises your exact keyword research SOP:
- **Step 1** AI business profile (reuses audit output)
- **Step 2** Seed keyword extraction
- **Step 3** SERP competitor discovery (direct + organic buckets)
- **Step 4** Competitor metrics pull (Ahrefs: DR, traffic, top pages, backlinks)
- **Step 5** Reverse-engineer top-converting URLs (Ahrefs Site Explorer)
- **Step 6** Topical map builder: Pillar → Cluster using Ahrefs Matching Terms + Questions
- **Step 7** Content Gap (client vs 3–5 competitors, Ahrefs Content Gap)
- **Step 8** Consolidated keyword sheet with intent tagging (TOFU/MOFU/BOFU) + LSI mapping
- Export to CSV / Google Sheets via Make.com

### Module 3 — Content Engine
- AI content brief generation (Claude) for each target keyword
- Full article generation with E-E-A-T structure
- Internal linking suggestions based on topical map
- Human review queue in dashboard
- CMS publishing via Make.com webhooks (Webflow, WordPress, Contentful adapters)

### Module 4 — Lead CRM (Internal)
- Every audit submission stored as a lead record
- Lead scoring based on: domain size, gap size, competitor spend
- Slack notification via Make.com on each new lead
- Booking link inserted into report and follow-up email sequence

---

## 3. Repository Structure (Monorepo)

```
calibrate-commerce/
├── apps/
│   ├── web/                    # Next.js 14 App Router (Vercel)
│   │   ├── app/
│   │   │   ├── (public)/       # Lead magnet pages (no auth)
│   │   │   ├── (dashboard)/    # Authenticated workspace
│   │   │   └── api/            # Next.js route handlers (lightweight)
│   │   └── components/
│   ├── api/                    # NestJS (AWS ECS or Lambda)
│   │   ├── src/
│   │   │   ├── audit/          # Audit orchestration
│   │   │   ├── keywords/       # Keyword research pipeline
│   │   │   ├── content/        # Content generation
│   │   │   ├── reports/        # PDF generation
│   │   │   ├── leads/          # Lead CRM
│   │   │   ├── integrations/   # Ahrefs, SEMRush, SerpAPI, Claude
│   │   │   └── webhooks/       # Make.com + Clerk webhooks
│   └── workers/                # BullMQ workers (AWS)
│       ├── audit.worker.ts
│       ├── keyword.worker.ts
│       └── content.worker.ts
├── packages/
│   ├── database/               # Prisma schema + migrations
│   ├── shared/                 # TypeScript types, DTOs, utils
│   └── ui/                     # Shared React components
├── infrastructure/
│   ├── terraform/              # AWS infra (ECS, RDS, ElastiCache, S3)
│   └── docker/
└── .github/
    └── workflows/              # CI/CD to Vercel + AWS
```

---

## 4. Database Schema (Prisma)

```prisma
model User {
  id          String   @id @default(cuid())
  clerkId     String   @unique
  email       String   @unique
  orgId       String?
  createdAt   DateTime @default(now())
  audits      Audit[]
  keywords    KeywordProject[]
}

model Lead {
  id              String    @id @default(cuid())
  email           String
  name            String
  websiteUrl      String
  businessDetails Json
  auditId         String?   @unique
  audit           Audit?    @relation(fields: [auditId], references: [id])
  score           Int?
  status          LeadStatus @default(NEW)
  createdAt       DateTime  @default(now())
}

model Audit {
  id              String    @id @default(cuid())
  websiteUrl      String
  status          AuditStatus @default(PENDING)
  businessProfile Json?
  seoScore        Int?
  geoScore        Int?
  aeoScore        Int?
  contentGapCount Int?
  estimatedTrafficLoss Int?
  competitors     Json?
  seedKeywords    String[]
  reportUrl       String?
  rawData         Json?
  userId          String?
  user            User?     @relation(fields: [userId], references: [id])
  lead            Lead?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model KeywordProject {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  name         String
  websiteUrl   String
  seedKeywords String[]
  competitors  Json?
  topicalMap   TopicalMap[]
  keywords     Keyword[]
  createdAt    DateTime  @default(now())
}

model Keyword {
  id              String   @id @default(cuid())
  projectId       String
  project         KeywordProject @relation(fields: [projectId], references: [id])
  keyword         String
  kd              Int?
  searchVolume    Int?
  intent          KeywordIntent
  funnel          FunnelStage
  targetUrl       String?
  lsiKeywords     Json?
  status          KeywordStatus @default(DISCOVERED)
  contentPiece    ContentPiece?
  createdAt       DateTime @default(now())
}

model ContentPiece {
  id          String   @id @default(cuid())
  keywordId   String   @unique
  keyword     Keyword  @relation(fields: [keywordId], references: [id])
  title       String
  brief       Json?
  body        String?  @db.Text
  status      ContentStatus @default(BRIEF)
  publishedUrl String?
  publishedAt DateTime?
  createdAt   DateTime @default(now())
}

enum AuditStatus  { PENDING PROCESSING COMPLETE FAILED }
enum LeadStatus   { NEW CONTACTED QUALIFIED CONVERTED LOST }
enum KeywordIntent { TRANSACTIONAL COMMERCIAL INFORMATIONAL NAVIGATIONAL }
enum FunnelStage  { TOFU MOFU BOFU }
enum KeywordStatus { DISCOVERED APPROVED BRIEF_READY WRITTEN PUBLISHED }
enum ContentStatus { BRIEF DRAFT REVIEW APPROVED PUBLISHED }
```

---

## 5. Integration Layer

### Ahrefs API v3
- `/v3/site-explorer/overview` — domain metrics (DR, traffic, keywords, backlinks)
- `/v3/site-explorer/top-pages` — competitor top pages
- `/v3/site-explorer/keywords-by-traffic` — top ranking keywords
- `/v3/keywords-explorer/matching-terms` — seed keyword expansion
- `/v3/site-explorer/content-gap` — content gap analysis

### SEMRush API
- Domain overview (backup/cross-validation for Ahrefs)
- Keyword Magic Tool (additional keyword suggestions)
- Position tracking

### SerpAPI / Google Custom Search
- SERP competitor discovery
- Featured snippet / People Also Ask extraction (AEO signals)
- "AI Overview" presence detection (GEO signals)

### Claude API (Anthropic)
- Business profile generation (Step 01 of your SOP)
- Audit scoring narratives
- Report personalisation copy
- Content brief generation
- Full article writing with E-E-A-T structure

### Resend
- Transactional: report delivery email (HTML + PDF attachment)
- Drip: 3-email follow-up sequence (Make.com triggered)

### Make.com Automation Flows
1. `audit.complete` webhook → send report email via Resend → notify Slack
2. `keyword.approved` → trigger content brief generation → update DB
3. `content.approved` → publish to CMS via adapter (Webflow/WordPress/Contentful)
4. `lead.new` → score lead → create contact in CRM (HubSpot/Pipedrive)
5. `keyword.sheet.export` → write to Google Sheets

---

## 6. Audit Scoring Methodology

Each dimension scored 0–100:

**Technical SEO (25%)**
- Core Web Vitals (LCP, FID, CLS) from PageSpeed API
- Mobile friendliness
- Schema markup presence
- Meta completeness (title, description, OG)
- Robots/sitemap health
- HTTPS + canonical setup

**Content Coverage (30%)**
- Pages indexed vs competitors avg
- Keyword gap count (keywords competitors rank for, you don't)
- TOFU/MOFU/BOFU balance
- Topical authority score (pillar + cluster depth)

**Backlink Authority (25%)**
- Domain Rating vs competitor median
- Referring domains vs competitor median
- Referring domain growth trend

**AEO + GEO Readiness (20%)**
- FAQ/schema on key pages
- Featured snippet eligibility
- AI Overview appearances (via SerpAPI result scanning)
- E-E-A-T signals: About, author, citations

**Traffic Loss Estimate**
```
lost_traffic = sum(keyword_volume × 0.3 × (1 - current_position_ctr))
               for all gap keywords in positions 1–10
```
Round to nearest 500. Displayed as "You are missing ~X visits/month."

---

## 7. Build Phases

### Phase 0 — Foundation (Week 1–2)
- Monorepo setup (Turborepo)
- Next.js 14 App Router + Clerk auth
- NestJS API scaffold + Prisma + PostgreSQL (local Docker)
- BullMQ + Redis (local Docker)
- CI/CD: GitHub Actions → Vercel (web) + AWS ECR/ECS (api + workers)
- Base UI component library (Shadcn/ui)

### Phase 1 — Lead Magnet MVP (Week 3–5)
- Public audit submission form
- Audit pipeline worker (scrape → profile → score → report)
- Claude integration for business profile + report copy
- Ahrefs integration for domain + competitor metrics
- PDF report generation (Puppeteer)
- Resend email delivery
- Lead storage + basic admin view
- PostHog + GA4 event tracking

### Phase 2 — Keyword Research Pipeline (Week 6–9)
- Authenticated dashboard (Clerk-gated)
- KeywordProject CRUD
- Competitor discovery + metrics pull (Steps 4–7 of SOP)
- Ahrefs matching terms + questions pull (Method 02)
- Content gap tool (Method 03)
- Keyword sheet view with intent tagging UI
- CSV export + Make.com → Google Sheets automation

### Phase 3 — Topical Map Builder (Week 10–12)
- Visual pillar + cluster map (interactive tree UI)
- Pillar/cluster page assignment
- URL structure planner
- Internal link mapping

### Phase 4 — Content Engine (Week 13–16)
- Content brief generation (Claude)
- Full article generation pipeline
- Human review / edit interface
- CMS publishing adapters (Webflow first, WordPress second)
- Make.com publish webhook

### Phase 5 — Lead CRM + Sales Layer (Week 17–18)
- Lead scoring algorithm
- Slack notification automation (Make.com)
- Follow-up email sequence (Make.com → Resend)
- Booking link injection in reports (Cal.com / Calendly)
- Lead → client conversion tracking

---

## 8. Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo | Turborepo | Shared types between Next.js + NestJS + workers |
| ORM | Prisma | Type safety, migration management |
| Job queue | BullMQ + Redis | Reliable async for long audit pipelines |
| PDF generation | Puppeteer (headless Chrome) | Pixel-perfect reports from HTML templates |
| Scraping | Cheerio (static) + Playwright (JS-heavy) | Cost-efficient, fallback for SPAs |
| File storage | AWS S3 + CloudFront | Report PDFs, generated content |
| Email | Resend | Dev-friendly, reliable delivery |
| CMS adapters | Abstract adapter pattern | Swap Webflow/WP/Contentful without core changes |
| Rate limiting | Redis token bucket per API key | Protect Ahrefs/SEMRush quotas |

---

## 9. Environment Variables (`.env.example`)

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# AWS
AWS_REGION=
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# External APIs
AHREFS_API_KEY=
SEMRUSH_API_KEY=
SERPAPI_KEY=
ANTHROPIC_API_KEY=

# Email
RESEND_API_KEY=
EMAIL_FROM=reports@calibratecommerce.com

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_GA_MEASUREMENT_ID=

# Make.com
MAKE_WEBHOOK_AUDIT_COMPLETE=
MAKE_WEBHOOK_CONTENT_APPROVED=
MAKE_WEBHOOK_LEAD_CREATED=

# Google
PAGESPEED_API_KEY=
```

---

## 10. Make.com Automation Flows (Detail)

### Flow 1 — Audit Complete → Report Delivery
```
Trigger: Webhook (NestJS fires when audit.status = COMPLETE)
→ Get report PDF URL from S3
→ Resend: send branded email with PDF attachment
→ Slack: post to #new-leads channel with lead summary + score
→ (Optional) HubSpot/Pipedrive: create contact
```

### Flow 2 — Content Approved → CMS Publish
```
Trigger: Webhook (dashboard "Approve & Publish" button)
→ Fetch full article from DB API
→ Route by CMS type (Webflow / WordPress / Contentful)
→ Create/update CMS item
→ Set status = PUBLISHED + store published URL
→ Notify Slack #content-published
```

### Flow 3 — Keyword Sheet Export
```
Trigger: Dashboard "Export to Sheets" button
→ Fetch all approved keywords for project
→ Google Sheets: append/overwrite sheet with full keyword data
→ Return Sheets URL to dashboard
```

---

## 11. GitHub Copilot Workspace Prompt

Copy this entire prompt into Copilot Workspace or a new VS Code Chat session as your starting instruction:

---

```
You are a senior full-stack engineer helping build "Calibrate Commerce" — 
a multi-tenant SaaS product for automated SEO/GEO/AEO auditing and organic 
visibility growth. Here is the complete technical specification:

PRODUCT:
- Public lead magnet: visitors submit their URL + email and receive a 
  personalised organic visibility report showing SEO score, content gaps, 
  traffic loss estimate, and competitor comparison
- Authenticated dashboard: keyword research pipeline, topical map builder, 
  content generation engine, CMS publishing queue

TECH STACK:
- Frontend: Next.js 14 App Router deployed to Vercel
- Auth: Clerk (JWT, webhooks, organisations)
- API: NestJS with REST endpoints and WebSocket for job progress
- Workers: BullMQ + Redis for async audit/keyword/content pipelines
- Database: PostgreSQL with Prisma ORM
- Storage: AWS S3 + CloudFront for PDFs and assets
- Email: Resend
- Queue: BullMQ backed by AWS ElastiCache (Redis)
- Deployment: Vercel (web), AWS ECS (api + workers)
- Repo: Turborepo monorepo on GitHub
- Analytics: PostHog + Google Analytics 4
- Automation: Make.com webhooks for email, CMS publishing, Slack, CRM
- External APIs: Ahrefs v3, SEMRush, SerpAPI, Claude (Anthropic), 
  PageSpeed Insights

MONOREPO STRUCTURE:
apps/web      — Next.js 14 App Router
apps/api      — NestJS REST API
apps/workers  — BullMQ workers
packages/database  — Prisma schema + client
packages/shared    — TypeScript types, DTOs
packages/ui        — Shared React components (Shadcn/ui base)

TASK — Phase 0 Foundation:
Scaffold the complete monorepo using Turborepo. For each app and package:

1. apps/web
   - Next.js 14 with App Router and TypeScript
   - Clerk auth installed and configured (@clerk/nextjs)
   - Middleware protecting /dashboard/* routes
   - Public route: /audit (lead magnet form page)
   - Shadcn/ui initialised
   - PostHog provider in layout
   - Environment variable types declared in env.d.ts

2. apps/api
   - NestJS with TypeScript
   - Modules: AuditModule, LeadsModule, KeywordsModule, 
     ContentModule, ReportsModule, WebhooksModule, IntegrationsModule
   - BullMQ integration (@nestjs/bullmq)
   - Prisma service injected via DatabaseModule
   - Clerk JWT guard applied to all protected routes
   - Health check endpoint GET /health
   - Swagger docs at /docs

3. apps/workers
   - Standalone NestJS app consuming BullMQ queues
   - Queues: audit-queue, keyword-queue, content-queue
   - Each worker logs job start/progress/complete/failed

4. packages/database
   - Prisma schema with all models: User, Lead, Audit, 
     KeywordProject, Keyword, ContentPiece (full schema in spec)
   - Seed script for local development
   - Generated client exported for use in api and workers

5. packages/shared
   - TypeScript interfaces mirroring Prisma models
   - DTOs: CreateAuditDto, CreateLeadDto, CreateKeywordProjectDto
   - Enums: AuditStatus, LeadStatus, KeywordIntent, FunnelStage

6. Root config
   - turbo.json with build/dev/test pipelines
   - Root package.json with workspace scripts
   - .env.example with all required variables
   - Docker Compose: postgres + redis for local dev
   - GitHub Actions: lint + typecheck on PR, 
     deploy web to Vercel on main, 
     build and push api+workers Docker image to AWS ECR on main

Generate all files with complete, working code. Use strict TypeScript throughout.
Follow NestJS best practices: dependency injection, module boundaries, 
repository pattern for database access. Use Prisma transactions where 
multiple writes must be atomic. All async functions must handle errors 
with proper NestJS exception filters.

After scaffolding Phase 0, confirm with a file tree showing every 
generated file and ask which module to build next.
```

---

## 12. Subsequent Copilot Prompts (Phase 1)

Once Phase 0 is scaffolded, use this prompt to build the audit pipeline:

```
Build the complete audit pipeline for Phase 1 — Lead Magnet MVP.

The audit pipeline is triggered when a visitor submits the public form at /audit.
It runs asynchronously via BullMQ and follows these steps:

STEP 1 — Lead Capture (NestJS LeadsController POST /leads)
- Accept: { websiteUrl, name, email, businessDescription }
- Create Lead record (status: NEW)
- Create Audit record (status: PENDING)
- Enqueue job on 'audit-queue' with { auditId, leadId, websiteUrl }
- Return: { auditId } immediately (client polls for progress)

STEP 2 — Audit Worker (apps/workers/src/audit.worker.ts)
Process the queued job through these sequential steps, updating 
audit.status and emitting WebSocket progress events after each:

2a. SCRAPE — Use Cheerio to fetch and parse the submitted URL.
    Extract: title, meta description, h1s, visible body text (max 3000 chars),
    internal link count, image alt coverage, schema markup presence.
    Fallback to Playwright if Cheerio returns empty body.

2b. PAGESPEED — Call Google PageSpeed Insights API for mobile + desktop.
    Extract: LCP, CLS, FID scores, performance score, SEO score, 
    accessibility score.

2c. BUSINESS PROFILE — Call Claude API (claude-sonnet-4-20250514).
    System: "You are a data-driven marketing analyst. Respond only in JSON."
    User: [scraped content + businessDescription] + prompt from SOP Step 01.
    Extract: { brandIdentity, targetMarket, services[], geography, 
               toneOfVoice, seedKeywords[] (5-10 keywords) }

2d. DOMAIN METRICS — Call Ahrefs API v3 /site-explorer/overview.
    Extract: domainRating, referringDomains, backlinks, 
             estimatedMonthlyTraffic, totalKeywords.

2e. COMPETITOR DISCOVERY — Call SerpAPI for top 3 seed keywords.
    Identify top 5 ranking domains. Filter out: the client's own domain,
    Wikipedia, Reddit, major aggregators. Store as competitors[].

2f. COMPETITOR METRICS — For each competitor, call Ahrefs 
    /site-explorer/overview + /site-explorer/top-pages (top 5).

2g. CONTENT GAP — Call Ahrefs /site-explorer/content-gap.
    Input: client domain + top 3 competitors. Filter: keywords where 
    2+ competitors rank but client does not. Take top 20 by volume.

2h. SCORING — Calculate four scores (each 0-100):
    technicalSeo: weighted average of PageSpeed signals
    contentCoverage: based on gap count vs competitor keyword volume ratio
    backlinkAuthority: DR ratio vs competitor median DR
    aeoGeoReadiness: schema presence + FAQ detection + featured snippet count

2i. REPORT GENERATION — Call Claude to generate personalised report copy.
    Then use Puppeteer to render an HTML report template to PDF.
    Upload PDF to S3. Store URL in audit.reportUrl.

2j. EMAIL DELIVERY — Call Resend API to send branded email to lead.email
    with PDF attached. Subject: "Your Organic Visibility Report is ready"

2k. MAKE.COM WEBHOOK — POST to MAKE_WEBHOOK_AUDIT_COMPLETE with 
    { leadId, auditId, score, websiteUrl, email, reportUrl }

STEP 3 — Progress Polling (Next.js frontend)
The /audit page polls GET /audits/:id/status every 3 seconds.
Show a progress bar with step labels. On complete, show score summary 
and "Check your email" message with the key stats inline.

Generate all files with complete working code. Include proper error 
handling: if any step fails, mark audit.status = FAILED and send a 
fallback email with a "we'll be in touch" message.
```

---

## 13. Rate Limiting Strategy for External APIs

```typescript
// Redis token bucket per API — prevent quota exhaustion
// Ahrefs: 500 req/month on Lite, 5000 on Standard
// SEMRush: 3000 req/day
// SerpAPI: 100 req/month free, 5000 on paid

// Middleware applied at the IntegrationsService level
class RateLimiter {
  async consume(apiName: string, cost: number = 1): Promise<void> {
    const key = `ratelimit:${apiName}`;
    const current = await redis.incrby(key, cost);
    if (current === cost) {
      // First use — set monthly expiry
      await redis.expire(key, 30 * 24 * 60 * 60);
    }
    if (current > LIMITS[apiName]) {
      throw new TooManyRequestsException(`${apiName} quota exhausted`);
    }
  }
}
```

**Optimisation for free/low-quota tier:**
- Cache Ahrefs domain metrics for 7 days per domain (Redis)
- Cache SERP results for 24 hours per query
- For the lead magnet, limit Ahrefs calls to: 1× overview (client) + 3× overview (competitors)
- Full Ahrefs pipeline (all methods) reserved for authenticated paid users

---

## 14. AEO + GEO Scoring Notes

**AEO (Answer Engine Optimisation)** — signals Claude detects:
- FAQ schema markup on pages
- Question-format headings (H2/H3 starting with What/How/Why/When)
- Concise 40–60 word answer paragraphs under questions
- People Also Ask appearance in SERP results (via SerpAPI)

**GEO (Generative Engine Optimisation)** — signals detected:
- Scan SerpAPI results for "AI Overview" or "AI-generated" labels
- Check for citations of the domain in AI overviews
- E-E-A-T signals: author bios, credentials, citation links, About page quality
- Structured data richness (BreadcrumbList, HowTo, Article schema)

Score these independently and show them as separate meters in the report — they are still emerging metrics that many agencies don't measure, which is a strong differentiator in the report.

---

*Document version: 1.0 — Calibrate Commerce Master Plan*
*Built for: VSCode + GitHub Copilot*
