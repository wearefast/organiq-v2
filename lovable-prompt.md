# Lovable Build Prompt — Calibrate Commerce (Pulse)

## What This Is

Build a complete, beautiful, production-quality UI for **Calibrate Commerce** — a multi-tenant SaaS **Organic Visibility Engine** for SEO agencies. It has two surfaces:

1. **Public Lead Magnet** — A free personalized SEO/GEO/AEO audit report (no login required). Visitors submit their website URL and receive an automated comprehensive audit.
2. **Authenticated Dashboard** — A keyword research pipeline, topical map generator, content engine, and lead CRM for SEO strategists.

The brand identity is premium, data-rich, and professional — think "enterprise analytics tool meets modern SaaS." It should feel like a sophisticated SEO command center.

---

## App Structure & Pages

### Navigation

**Public pages** (no auth):
- `/` — Landing page
- `/audit` — Public audit submission form
- `/audit/[id]` — Public audit results (gradient hero, impressive presentation)

**Dashboard** (authenticated, sidebar navigation):
- `/dashboard` — Overview with stats cards
- `/dashboard/audits` — Audit list
- `/dashboard/audits/new` — New audit form
- `/dashboard/audits/[id]` — Audit detail (restrained header, tabbed results)
- `/dashboard/audits/[id]/pipeline` — Live analysis control room (dark theme)
- `/dashboard/keywords` — Keyword project list
- `/dashboard/keywords/new` — Create project
- `/dashboard/keywords/[projectId]` — Project workspace
- `/dashboard/keywords/[projectId]/workflows/[workflowId]` — Workflow shell (sidebar rail + step content)
- `/dashboard/content` — Content pipeline (briefs & articles)
- `/dashboard/leads` — Lead CRM list

**Dashboard sidebar nav items:**
- Dashboard (home icon)
- Audits (search/scan icon)
- Keywords (key icon)
- Content (document icon)
- Leads (users icon)

---

## Page-by-Page Specifications

### 1. Landing Page (`/`)

A premium marketing landing page for the SEO audit tool. Sections:
- **Hero**: Dark navy background with gradient accent. Headline: "Your Organic Visibility Engine". Subheading explaining the free audit + full platform. CTA button: "Get Your Free Audit" (gradient red).
- **How it works**: 3-step visual (Submit URL → AI Analysis → Get Report)
- **Features grid**: 4 cards showcasing Audit Engine, Keyword Research, Content Generation, Lead Intelligence
- **Social proof**: Testimonial placeholders
- **Footer CTA**: Repeat the free audit CTA

### 2. Public Audit Form (`/audit`)

A clean, focused form centered on the page with the gradient hero background at top:
- **Fields**: Website URL (required), Full Name, Email, Business Description (textarea)
- **Country selector**: Dropdown with flag icons
- **Submit button**: Brand gradient, full-width on mobile
- **Trust signals**: "Free • No credit card • Results in 2 minutes"

### 3. Public Audit Results (`/audit/[id]`)

This is the "wow" page for lead capture. It should feel premium and impressive.

**Header**: Full-width gradient hero (`#071932 → #AE213E → #DA304F`) containing:
- Website URL / business name (large, white text)
- Overall audit score (large circular progress ring, white)
- Quick stat strip: 4 metrics in a row (Technical SEO score, Content Coverage score, Backlink Authority score, AEO/GEO score) — each as a mini card with the score number prominent
- "Download PDF" and "Email Report" action buttons (white outline on dark)

**Tab Bar**: Horizontally scrollable tabs below the hero:
- Overview | Keywords & Topics | Competitors | Content Gap | Performance

**Tab Content**:

**Overview Tab**:
- Business Profile card (AI-generated summary of the business)
- Deep Read card (what they do, who they serve, how they differentiate)
- Seed Keywords (pill tags showing discovered keywords)
- Website Crawl Stats (pages found, schema types, meta analysis)

**Keywords & Topics Tab**:
- Core Keywords table (keyword, volume, KD, intent badge)
- Money Keywords table (commercial/transactional terms)
- Topic Clusters visualization (grouped keywords by theme, each cluster as a card)
- Entities section (named entities found)

**Competitors Tab**:
- Direct Competitors section (cards with domain, DR, traffic, top pages)
- Organic Competitors section (overlap analysis)
- SERP Analysis table (who ranks for their target terms)

**Content Gap Tab**:
- Gap Keywords table (keywords competitors rank for but this site doesn't)
- Columns: Keyword, Volume, KD, # Competitors Ranking, Estimated Traffic Lost
- Topic Groups (gap keywords clustered by theme)
- Competitor Coverage Matrix (heatmap-style: rows=keywords, cols=competitors, cells=ranking position)
- Emerging Opportunities section

**Performance Tab**:
- Score rings: Performance, SEO, Accessibility (circular progress, color-coded)
- Core Web Vitals: LCP, FID, CLS (metric cards with good/needs-improvement/poor indicators)
- On-Page SEO Signals (checklist-style: title tag, meta description, H1, schema, canonical, robots)

### 4. Dashboard Layout

**Shell structure**:
- Left sidebar (240px, collapsible): Logo at top, nav items with icons, user avatar at bottom
- Top bar: Breadcrumb trail
- Main content area: Page fills remaining space, max-width 1280px, padding 32px

### 5. Dashboard Overview (`/dashboard`)

Stats cards in a 2x2 or 4-column grid:
- Total Audits (count + "X this week" subtext)
- Active Keywords (count)
- Content Pieces (count + status breakdown)
- Leads Captured (count + conversion rate)

Below: Recent activity feed (last 5 audits/workflows with timestamps)

### 6. Audit List (`/dashboard/audits`)

**Header**: "Audits" title (32px bold) + "Track all audit reports" subtitle + right-aligned "+ New Audit" button (navy solid)

**Filter bar**: Search by domain input + Status dropdown filter + Date range

**Table** (in a card container):
- Columns: Website (with favicon), Status (badge), SEO Score, Content Score, Authority Score, AEO Score, Date
- Status badges: Complete (green), Processing (blue, with animated pulse dot), Failed (red), Pending (amber)
- Rows are clickable → navigate to detail
- Processing rows show a subtle animated indicator

**Empty state**: Centered card with illustration, "No audits yet" message, and CTA button

### 7. Audit Detail — Dashboard (`/dashboard/audits/[id]`)

**Different from public version**: No gradient hero. Instead:
- **Header card** (white, bordered): Website URL, status badge, date, scores as small stat blocks, action buttons (Download PDF, Email, Re-run)
- **Breadcrumb**: Audits / example.com
- **Same tab structure** as public (Overview, Keywords, Competitors, Content Gap, Performance) but styled consistently with dashboard patterns (neutral colors, no gradients on text)

### 8. Live Analysis Pipeline (`/dashboard/audits/[id]/pipeline`)

**IMPORTANT: This is an intentionally dramatic, dark-themed "control room" page.** It's a showpiece that runs while the audit is processing.

**Design**: Full dark background (`#071932` to `#0F172A`), with:

- **Left column — Step Progress Rail**: Vertical list of all 15 pipeline steps. Each step shows:
  - Step number (in a circle)
  - Step name
  - Status: pending (dim), running (glowing blue pulse), complete (green check), failed (red x)
  - Completed steps show duration taken
  - Currently running step has an animated progress bar

- **Center column — AI Engine Visualization**: 
  - Abstract animated orb/nucleus in the center (subtle CSS animation, glowing)
  - Input flowing in from the left (data labels fading in)
  - Output flowing to the right (processed results appearing)
  - Current phase label underneath: "Analyzing competitors..." / "Generating profile..." etc.

- **Right column — Telemetry**:
  - Elapsed time counter
  - Steps completed: X/15
  - Current phase name
  - Data points processed counter (animated counting up)

- **Bottom strip — Process Log**:
  - Scrolling log of recent events in mono font
  - Timestamps + descriptions: "14:32:05 — Scraped homepage (247 elements found)"
  - Auto-scrolls to latest

- **Completion**: When all 15 steps complete, show a celebratory state (score reveal animation) then auto-redirect to results page after 3 seconds, or show a "View Results" CTA button.

### 9. Keyword Project List (`/dashboard/keywords`)

**Header**: "Keywords" title + subtitle "Manage your keyword research projects" + "+ New Project" button

**Project cards** (grid, 1–2 columns):
Each card shows:
- Project name (bold)
- Website URL (muted, with favicon)
- Seed keywords (first 5 as pill tags, +N more)
- Status badge (active workflow status)
- Last activity timestamp
- Click → opens project workspace

### 10. Keyword Project Workspace (`/dashboard/keywords/[projectId]`)

**Layout**: Two sections stacked:

**Top — Project Info Card**:
- Project name, website, created date
- Seed keywords (pills)
- Competitors (if set)

**Bottom — Workflow Runs**:
- Table/list of workflow runs for this project
- Columns: Run #, Language, Country, Status, Current Step, Started, Actions
- Primary CTA: "Start New Workflow" (opens country/language selector modal, then creates run)
- Click on a run → opens the workflow shell

### 11. Keyword Workflow Shell (`/dashboard/keywords/[projectId]/workflows/[workflowId]`)

**THIS IS THE CORE POWER-USER INTERFACE. It must feel like a structured, productive workspace.**

**Layout** — Two-panel:

**Left Rail (fixed, 280px)**: Vertical step list (all 13 steps):
1. Business Profile
2. Seed Keywords
3. SERP Niche Map
4. Competitor Buckets
5. Competitor Metrics
6. Phase 1 Baseline
7. Method 01 — Competitor Pages
8. Method 02 — Seed Expansion
9. Method 03 — Content Gap Import
10. Consolidation
11. Topical Map
12. Content Brief
13. Content Article

Each step in the rail shows:
- Step number (in a small circle, color-coded by status)
- Step name
- Status icon: not started (grey dot), running (blue spinner), awaiting review (amber clock), approved (green check), rejected (red x)
- The active step is highlighted with a left border accent

**Right Panel (scrollable main content)** — Shows the currently active step:

**Step Content Pattern** (output-first design):
1. **Output section** (top, prominent): The generated artifact displayed in a readable card. Could be a business profile summary, keyword table, competitor list, etc. This is what the strategist reviews.
2. **Action buttons**: "Approve" (green/navy), "Request Revision" (amber), "Reject" (red outline) — these are the approval gate controls
3. **Input section** (collapsed by default): Expandable form showing what inputs were used to generate this step. Strategist can edit and regenerate.
4. **History** (bottom): Previous versions of this artifact if revisions were made

**Step-specific content types**:
- **Business Profile**: Rich text card showing brand name, market, services, geography, seed keyword suggestions
- **Seed Keywords**: Editable list/table of keywords (candidate vs approved toggle)
- **SERP Niche Map**: Structured view of core topics, sub-topics, page-type observations
- **Competitor Buckets**: Two columns — Direct competitors | Organic competitors (each as a card with domain + rationale)
- **Competitor Metrics**: Table with columns: Domain, DR, Traffic, Keywords, Referring Domains, Top Pages
- **Methods 01–03**: Keyword tables with source attribution
- **Consolidation**: Large keyword ledger table with provenance columns (method source, dedup status, approval status)
- **Topical Map**: Visual pillar/cluster tree structure. Pillars as top-level cards, clusters as nested items underneath, each with target keyword and content type
- **Content Brief**: Structured brief card (target keyword, pillar context, outline, editorial notes, internal links)
- **Content Article**: Full article preview with sections, headings, formatted body text

### 12. Content Pipeline (`/dashboard/content`)

**Header**: "Content" title + subtitle

**Table/Card view** of all content pieces:
- Columns: Title, Primary Keyword, Status (badge), Pillar, Created, Actions
- Status badges: Brief (blue), Draft (amber), Review (purple), Approved (green), Published (teal)
- Click → opens content detail (brief + article preview)
- Filter by status

**Content Detail** (modal or page):
- Left: Brief card (keyword, outline, notes)
- Right: Article preview (rendered markdown/HTML)
- Actions: Approve, Request Changes, Publish to CMS

### 13. Leads List (`/dashboard/leads`)

**Header**: "Leads" title + subtitle "All captured leads from audit submissions"

**Table** in a card:
- Columns: Name, Email, Website, Audit Score, Status (badge), Date
- Status badges: New (blue), Contacted (amber), Qualified (purple), Converted (green), Lost (grey)
- Click → opens lead detail drawer/modal with:
  - Contact info
  - Business description
  - Linked audit (with scores)
  - Status change dropdown
  - Notes field

### 14. Login Page (`/login`)

Simple centered card on the gradient background:
- Logo at top
- Email input
- Password input (or "Demo Login" button for dev mode)
- "Sign In" CTA button
- "Get a free audit instead" link below

---

## Interaction Patterns

### Loading States
- Use skeleton/shimmer cards while data loads (not plain text)
- Tables show skeleton rows (5 placeholder rows with animated shimmer)
- Single records show card skeletons matching the final layout

### Error States
- Card-based errors: `rounded-xl border border-red-200 bg-red-50 p-6` with error message and retry button

### Empty States
- Centered in the content area
- Illustration/icon + descriptive text + primary CTA button
- Each section has a contextual empty state ("No audits yet — run your first audit")

### Status Transitions
- Processing items show animated pulse/spinner indicators
- Completed items transition smoothly (no jarring reloads)
- Approval actions show confirmation before executing

### Responsive Design
- Sidebar collapses to icons on tablet, hidden with hamburger on mobile
- Tables become card lists on mobile
- The pipeline page is desktop-only (show a "view on desktop" message on mobile)
- Two-column grids stack to single column on mobile

---

## Data Models (for mock data)

### Audit
```typescript
{
  id: string
  websiteUrl: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  businessProfile: { name, market, services, geography }
  scores: { technical: number, content: number, authority: number, aeo: number }
  estimatedTrafficLoss: number
  competitors: { direct: [], organic: [] }
  seedKeywords: string[]
  contentGap: { keywords: [], topicGroups: [] }
  createdAt: Date
}
```

### Keyword Project
```typescript
{
  id: string
  name: string
  websiteUrl: string
  seedKeywords: string[]
  competitors: { domain, bucket }[]
  workflows: WorkflowRun[]
}
```

### Workflow Run
```typescript
{
  id: string
  status: 'draft' | 'running' | 'awaiting_approval' | 'completed'
  currentStep: number // 1-13
  language: string
  country: string
  steps: {
    key: string
    name: string
    status: 'not_started' | 'running' | 'awaiting_approval' | 'approved' | 'rejected'
    artifact: any // step-specific output data
  }[]
}
```

### Content Piece
```typescript
{
  id: string
  title: string
  keyword: string
  pillar: string
  status: 'brief' | 'draft' | 'review' | 'approved' | 'published'
  brief: { outline, notes, internalLinks }
  body: string // article HTML/markdown
  publishedUrl?: string
}
```

### Lead
```typescript
{
  id: string
  name: string
  email: string
  websiteUrl: string
  businessDescription: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  auditScore: number
  createdAt: Date
}
```

---

## Key UX Principles

1. **Output-first**: Always show results prominently. Forms and inputs are secondary (collapsed or below).
2. **Progressive disclosure**: Don't overwhelm. Show summary first, let users drill into detail.
3. **Consistent status language**: Every entity has a clear status badge. Users should always know "what state is this in?"
4. **Professional workspace feel**: The dashboard should feel like a power-user tool — information-dense but well-organized. Not too much whitespace, not too playful.
5. **Public pages are impressive**: The audit results and pipeline are designed to "wow" prospects. They should feel premium, polished, and data-rich.
6. **Dark theme ONLY for the pipeline**: Everything else is light. The pipeline control room is the one place we go cinematic.

---

## Tech Preferences

- Use **React** with **TypeScript**
- Use **Tailwind CSS** for styling
- Use **shadcn/ui** components as the base (Button, Card, Table, Badge, Tabs, Dialog, Sheet, Tooltip, etc.)
- Use **Lucide React** for icons
- Use **Recharts** or **Chart.js** for any score visualizations (rings, bars)
- Use **Framer Motion** for the pipeline page animations
- Route with React Router (or Next.js App Router patterns)
- Mock all data — no real backend needed. Use static JSON or faker for realistic demo data.
- Make it fully responsive (mobile-friendly except pipeline page)

---

## Summary

Build a complete UI with:
- 1 landing page
- 1 public audit form
- 1 public audit results page (gradient hero + 5 tabs of rich data)
- 1 dramatic dark-themed pipeline animation page
- 1 dashboard layout shell (sidebar + content)
- 1 dashboard overview (stats cards)
- 1 audit list page (table with filters)
- 1 audit detail page (restrained dashboard version)
- 1 keyword project list
- 1 keyword project workspace
- 1 keyword workflow shell (left rail + 13 step content areas with approval controls)
- 1 content pipeline page (table + detail view)
- 1 leads CRM page (table + detail drawer)
- 1 login page

All with consistent design system, proper loading/error/empty states, and realistic mock data. The keyword workflow shell is the most complex and important page — it should feel like a sophisticated multi-step workspace tool.
