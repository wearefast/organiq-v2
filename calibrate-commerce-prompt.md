# Prompt — Build "Calibrate Commerce" SaaS UI/UX

Paste this entire document into your VSCode AI agent (Cursor, Continue, Cline, Copilot Chat, etc.). It is a complete, self-contained build spec that recreates the same UI/UX shipped on Lovable.

---

## 0. Goal

Build a **production-grade SaaS web app** called **Calibrate Commerce** — an AI-powered SEO/AEO audit + keyword-research + content-production platform for ecommerce. The app must look polished, animated, and on-brand. Use mock in-memory data only (no backend yet). Every screen below must exist and be navigable.

## 1. Tech stack (non-negotiable)

- **TanStack Start v1** (React 19 + Vite 7, file-based routing in `src/routes/`)
- **TypeScript strict**
- **Tailwind CSS v4** configured via native CSS in `src/styles.css` (NOT `tailwind.config.js`). Use `@import "tailwindcss"` and `@theme inline` blocks. Color tokens in **OKLCH**.
- **shadcn/ui** ("new-york" style, slate base, lucide icons) installed under `src/components/ui/*`
- **Framer Motion** for all motion (`bun add framer-motion`)
- **lucide-react** for icons
- Routing imports always from `@tanstack/react-router` (Link, Outlet, useLocation, useNavigate, createFileRoute). Never `react-router-dom`.
- Single root layout file: `src/routes/__root.tsx`. No `_app/` folders.

## 2. Design system

Add this to `src/styles.css` verbatim (replace any existing tokens). Everything else in the app must consume these semantic tokens — never hardcode hex/rgb in components.

```css
@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: 'Gilroy','Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --font-mono: 'DM Mono',ui-monospace,SFMono-Regular,monospace;

  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --radius-xl: 16px; --radius-2xl: 20px; --radius-pill: 9999px;

  /* shadcn passthrough */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent); --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);

  /* brand tokens */
  --color-navy: var(--navy);
  --color-navy-light: var(--navy-light);
  --color-brand: var(--brand);
  --color-brand-dark: var(--brand-dark);
  --color-brand-light: var(--brand-light);
  --color-brand-soft: var(--brand-soft);
  --color-surface: var(--surface);
  --color-section-tint: var(--section-tint);
  --color-row-hover: var(--row-hover);
  --color-text-body: var(--text-body);
  --color-text-muted: var(--text-muted);

  /* status */
  --color-status-live: var(--status-live);
  --color-status-pending: var(--status-pending);
  --color-status-strategy: var(--status-strategy);
  --color-status-review: var(--status-review);
  --color-status-progress: var(--status-progress);
  --color-status-complete: var(--status-complete);
  --color-status-overdue: var(--status-overdue);

  /* sidebar */
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-border: var(--sidebar-border);

  --shadow-soft: 0 1px 2px oklch(0.2 0.04 260/.04), 0 4px 12px oklch(0.2 0.04 260/.04);
  --shadow-card: 0 2px 6px oklch(0.2 0.04 260/.05), 0 12px 32px oklch(0.2 0.04 260/.06);
  --shadow-glow: 0 10px 40px -10px oklch(0.59 0.21 18/.45);

  --gradient-hero: linear-gradient(135deg,#071932 0%,#AE213E 55%,#DA304F 100%);
  --gradient-cta: linear-gradient(135deg,#AE213E 0%,#DA304F 100%);
  --gradient-secondary-cta: linear-gradient(135deg,#071932 0%,#AE213E 100%);
  --gradient-sidebar: linear-gradient(180deg,#071932 0%,#102447 100%);
  --gradient-soft: linear-gradient(135deg,#FFF7F8 0%,#F8D6DC 100%);
  --gradient-pipeline: linear-gradient(135deg,#050f1f 0%,#0a1a33 50%,#061528 100%);
}

:root {
  --radius: 12px;
  --background: oklch(1 0 0);
  --foreground: oklch(0.21 0.04 260);
  --card: oklch(1 0 0); --card-foreground: oklch(0.21 0.04 260);
  --popover: oklch(1 0 0); --popover-foreground: oklch(0.21 0.04 260);
  --primary: oklch(0.59 0.21 18); --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.97 0.005 260); --secondary-foreground: oklch(0.21 0.04 260);
  --muted: oklch(0.97 0.005 260); --muted-foreground: oklch(0.55 0.02 260);
  --accent: oklch(0.97 0.01 12); --accent-foreground: oklch(0.49 0.19 18);
  --destructive: oklch(0.55 0.22 25); --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.93 0.01 260); --input: oklch(0.88 0.01 260); --ring: oklch(0.59 0.21 18);

  --navy: oklch(0.18 0.05 260); --navy-light: oklch(0.28 0.06 260);
  --brand: oklch(0.59 0.21 18);          /* #DA304F-ish red */
  --brand-dark: oklch(0.49 0.19 18);     /* #AE213E */
  --brand-light: oklch(0.74 0.12 14);
  --brand-soft: oklch(0.94 0.04 12);
  --surface: oklch(0.98 0.005 260);
  --section-tint: oklch(0.97 0.01 10);
  --row-hover: oklch(0.985 0.003 260);
  --text-body: oklch(0.42 0.03 260);
  --text-muted: oklch(0.69 0.02 260);

  --status-live: oklch(0.68 0.15 155);
  --status-pending: oklch(0.78 0.15 75);
  --status-strategy: oklch(0.55 0.22 295);
  --status-review: oklch(0.59 0.21 18);
  --status-progress: oklch(0.62 0.18 240);
  --status-complete: oklch(0.65 0.13 195);
  --status-overdue: oklch(0.45 0.20 20);

  --sidebar: oklch(0.18 0.05 260);
  --sidebar-foreground: oklch(0.92 0.01 260);
  --sidebar-accent: oklch(0.25 0.05 260);
  --sidebar-border: oklch(0.28 0.05 260);
}

@layer base {
  * { border-color: var(--color-border); }
  html, body { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
  body { background: var(--color-background); color: var(--color-foreground); }
  h1,h2,h3,h4 { letter-spacing: -0.01em; }
}

@layer utilities {
  .bg-gradient-hero { background-image: var(--gradient-hero); }
  .bg-gradient-cta { background-image: var(--gradient-cta); }
  .bg-gradient-secondary-cta { background-image: var(--gradient-secondary-cta); }
  .bg-gradient-sidebar { background-image: var(--gradient-sidebar); }
  .bg-gradient-soft { background-image: var(--gradient-soft); }
  .bg-gradient-pipeline { background-image: var(--gradient-pipeline); }
  .shadow-soft { box-shadow: var(--shadow-soft); }
  .shadow-card { box-shadow: var(--shadow-card); }
  .shadow-glow { box-shadow: var(--shadow-glow); }
  .font-mono { font-family: var(--font-mono); }
}

@keyframes pulse-ring { 0%,100%{box-shadow:0 0 0 0 oklch(0.62 0.18 240/.4);} 50%{box-shadow:0 0 0 8px oklch(0.62 0.18 240/0);} }
.animate-pulse-ring { animation: pulse-ring 1.6s ease-in-out infinite; }
@keyframes orb-glow { 0%,100%{transform:scale(1);filter:blur(0);opacity:.9;} 50%{transform:scale(1.06);filter:blur(2px);opacity:1;} }
.animate-orb { animation: orb-glow 3.5s ease-in-out infinite; }
@keyframes data-flow-in { 0%{opacity:0;transform:translateX(-20px);} 50%{opacity:1;} 100%{opacity:0;transform:translateX(60px);} }
.animate-data-in { animation: data-flow-in 3s ease-in-out infinite; }
@keyframes data-flow-out { 0%{opacity:0;transform:translateX(-60px);} 50%{opacity:1;} 100%{opacity:0;transform:translateX(20px);} }
.animate-data-out { animation: data-flow-out 3s ease-in-out infinite; }
```

Design rules for components:
- Buttons: pill-shape (`rounded-pill`), height `h-11`, primary uses `bg-gradient-cta text-white shadow-glow`, secondary uses `border border-border bg-background`.
- Cards: `rounded-2xl border border-border bg-card shadow-soft` (or `shadow-card` for elevated).
- Inputs: `h-11 rounded-[10px] border border-input bg-background px-3 text-sm`.
- Section labels: `text-[11px] font-bold uppercase tracking-widest text-text-muted`.
- Tables: header row is `bg-section-tint` + 11px uppercase muted; rows hover `bg-row-hover`; dividers via `border-b border-border`.
- Animation: page sections fade-up with `framer-motion` (`initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5}}`).

## 3. Mock data layer — `src/lib/mock-data.ts`

Create one file exporting these shapes (use realistic ecommerce-running-shoe seed data):

- `Audit` — `{id, websiteUrl, domain, businessName, status: "pending"|"processing"|"complete"|"failed", scores:{technical,content,authority,aeo}, overallScore, estimatedTrafficLoss, createdAt}` + array of ~7 `audits` + `getAudit(id)`.
- `seedKeywords`, `coreKeywords`, `moneyKeywords`, `topicClusters`, `directCompetitors`, `organicCompetitors`, `gapKeywords` arrays.
- `KeywordProject` with nested `WorkflowRun` + `WorkflowStep`. `WorkflowStepStatus = "not_started"|"running"|"awaiting_approval"|"approved"|"rejected"`.
- `WORKFLOW_STEPS` — exactly these 13 keys/names: `business_profile, seed_keywords, serp_niche_map, competitor_buckets, competitor_metrics, phase1_baseline, method_01 (Competitor Pages), method_02 (Seed Expansion), method_03 (Content Gap Import), consolidation, topical_map, content_brief, content_article`.
- `keywordProjects` (≥2 projects, each with workflow runs at different stages) + `getProject(id)` + `getWorkflow(projectId, workflowId)`.
- `ContentPiece` (`status: brief|draft|review|approved|published`) + `contentPieces` array of 5.
- `Lead` (`status: new|contacted|qualified|converted|lost`) + `leads` array of 5.
- `PIPELINE_STEPS` — array of exactly 15 audit-pipeline step strings: Initialize crawler, Fetch homepage & sitemap, Extract on-page signals, Discover internal pages, Detect schema & metadata, Score technical SEO, Identify business profile, Generate seed keywords, Map competitor landscape, Crawl competitor signals, Compute content gap, Score AEO & GEO surfaces, Aggregate authority metrics, Build topic clusters, Compile final report.

## 4. Shared components — `src/components/`

- **`Logo.tsx`** — gradient pill with letter "C" + dot, wordmark "Calibrate **Commerce**" (brand-red on second word). Accepts `variant: "light"|"dark"`.
- **`ScoreRing.tsx`** — SVG circular progress (configurable size, score 0-100, label). Stroke uses `--brand`. Center shows large bold number + small uppercase label.
- **`StatusBadge.tsx`** — pill badge that maps any status string (audit / workflow / content / lead) to one of the `--status-*` colors using a switch. `bg-status-x/15 text-status-x` style.

## 5. Routes — file-based (flat, dot-separated)

Create exactly these files under `src/routes/`:

```
__root.tsx
index.tsx                                          /
login.tsx                                          /login
audit.tsx                                          /audit             (public form)
audit.$id.tsx                                      /audit/:id         (public results)
dashboard.tsx                                      /dashboard         (layout with sidebar + Outlet)
dashboard.index.tsx                                /dashboard
dashboard.audits.index.tsx                         /dashboard/audits
dashboard.audits.new.tsx                           /dashboard/audits/new
dashboard.audits.$id.index.tsx                     /dashboard/audits/:id
dashboard.audits.$id.pipeline.tsx                  /dashboard/audits/:id/pipeline
dashboard.keywords.index.tsx                       /dashboard/keywords
dashboard.keywords.new.tsx                         /dashboard/keywords/new
dashboard.keywords.$projectId.index.tsx            /dashboard/keywords/:projectId
dashboard.keywords.$projectId.workflows.$workflowId.tsx
dashboard.content.tsx                              /dashboard/content
dashboard.leads.tsx                                /dashboard/leads
```

Each route file MUST `export const Route = createFileRoute("...")({ component })`. Never edit `routeTree.gen.ts`. Each route gets a unique `head()` with title + description + og tags.

### 5.1 `__root.tsx`
HTML shell (`shellComponent` returns `<html><head><HeadContent/></head><body>{children}<Scripts/></body></html>`). Wrap `<Outlet/>` in a `QueryClientProvider`. Provide a polished `notFoundComponent` (404 with link Home) and `errorComponent` (Try-again button calling `router.invalidate()` + `reset()`).

### 5.2 `/` Landing page (`index.tsx`)
Sections, top-to-bottom:
1. **Sticky transparent nav** with Logo, nav links (Product, Pricing, Audit), and "Sign in" + gradient "Run free audit" buttons.
2. **Hero**: full-width `bg-gradient-hero` (navy→red), white text, big headline ("Win the AI search era — before your competitors do."), subheadline, two CTAs (gradient pill + outlined ghost), animated decorative orbs (`animate-orb`). Right column shows a mock "Audit score" card floating (overall score ring + 4 sub-scores).
3. **Stats strip** — 4 metric tiles on tinted background.
4. **How it works** — 3 cards: Audit → Strategy → Content. Each has icon in gradient bg, title, copy.
5. **Pipeline preview** — dark `bg-gradient-pipeline` panel showing list of 6 PIPELINE_STEPS with animated pulse dots.
6. **Feature grid** — 6 feature cards (AEO/GEO scoring, Competitor maps, Topical maps, AI briefs, Approval workflows, Lead capture).
7. **CTA banner** — gradient card "Ready to calibrate?" + email input + Run audit.
8. **Footer** — logo, columns, copyright.

### 5.3 `/login`
Centered card on `bg-surface`. Logo. Email + password inputs. Gradient "Sign in" button (no auth, just `navigate('/dashboard')`). Link "Run a free audit instead".

### 5.4 `/audit` (public audit request form)
Two-column on `bg-gradient-soft`. Left: marketing copy + bullet list of what's included. Right: card with website URL, business name, email, business description (textarea), submit. On submit `navigate('/audit/aud_02')` (a "processing" id) — don't actually save.

### 5.5 `/audit/:id` (public results)
- Header band on `bg-navy` with white text: domain, "Audit complete" pill, big overall ScoreRing on right.
- 4 sub-score cards (Technical, Content, Authority, AEO).
- Tabbed section using shadcn Tabs: **Keywords** (table of coreKeywords + moneyKeywords), **Competitors** (direct + organic tables), **Performance** (estimated traffic loss + gap keywords).
- Sticky CTA at bottom: "Get the full strategy — book a call" gradient button.

### 5.6 `/dashboard` layout (`dashboard.tsx`)
- Persistent left sidebar `w-[240px]` `bg-gradient-sidebar` with Logo (dark variant), nav items (Dashboard, Audits, Keywords, Content, Leads — each with lucide icon). Active item: `bg-gradient-cta text-white shadow-glow`. User chip at bottom (avatar with initials, name, role).
- Top bar `h-16` with breadcrumbs derived from pathname + Search button + Bell button.
- Main `<Outlet/>` inside `max-w-[1280px] mx-auto px-8 py-8`.

### 5.7 `/dashboard` (index)
Welcome heading. 4 KPI cards (Active audits, Open workflows, Content in review, New leads). Two-column: recent audits table + recent leads list. Each card uses `shadow-soft`.

### 5.8 `/dashboard/audits` + `/audits/new`
- Index: header with "New audit" gradient button → table of audits (domain, business, score ring inline, status badge, date). Row click → `/dashboard/audits/:id`.
- New: form (URL, business name) → on submit create-and-navigate to `/audits/{id}/pipeline`.

### 5.9 `/dashboard/audits/:id/pipeline` — **HERO ANIMATED SCREEN**
Full-bleed dark `bg-gradient-pipeline` view. Centerpiece is an animated "telemetry" panel:
- Left column: vertical list of 15 PIPELINE_STEPS. Current step pulses (`animate-pulse-ring`), past steps show check, future steps dim.
- Center: large glowing orb (`animate-orb`) representing the AI agent. Around it, animated data tracers (`animate-data-in`/`animate-data-out`) suggesting flow.
- Right column: scrolling **log stream** — monospace lines using `font-mono text-xs` on darker panel; new lines appear via Framer Motion (`AnimatePresence` + slide-up). Use a `setInterval` (cleared on unmount) to advance step every ~2.5s and append fake log lines like `[crawler] GET https://acmeshoes.com/sitemap.xml → 200 (412ms)`.
- After step 15, show "Audit complete" CTA → `/dashboard/audits/:id`.

### 5.10 `/dashboard/audits/:id` (results in dashboard)
Same content blocks as public results but inside dashboard chrome; add an "Export PDF" outline button and "Create keyword project from this audit" gradient button.

### 5.11 `/dashboard/keywords` + `/keywords/new` + `/keywords/:projectId`
- Index: grid of project cards (name, domain, last activity, # workflows, gradient "Open" arrow).
- New: form (project name, URL, seed keywords as tag input).
- Project detail: header with project meta + "Start new workflow" button. Tabs: **Workflows** (list of WorkflowRun cards showing run #, current step, status badge, started, button "Resume"), **Seed keywords** (chips), **Competitors** (split direct/organic).

### 5.12 `/dashboard/keywords/:projectId/workflows/:workflowId` — **13-step workflow shell**
Three columns:
1. **Left rail (240px)** — vertical stepper for the 13 WORKFLOW_STEPS. Each item shows index, name, status icon (dot/spinner/check/x). Clicking a completed step jumps to it.
2. **Main panel** — current step card with: title, description, **Output preview** area (mock JSON-ish or tables depending on step), **Version history** dropdown (v1, v2, v3 with timestamps), **Approval gate** at bottom: "Reject" outline + "Approve & continue" gradient button. Show toast/snackbar on approve and advance step.
3. **Right rail (320px)** — context: language, country, prompt parameters, AI cost estimate.

Step-specific output mocks (just static visuals; no real generation):
- Business Profile: 6 key/value rows.
- Seed Keywords: chip cloud.
- SERP Niche Map: 2-column tag list.
- Competitor Buckets: two tables direct/organic.
- Competitor Metrics: bar-chart-ish rows.
- Phase 1 Baseline: stat tiles.
- Methods 01/02/03: keyword tables with vol/KD/intent columns.
- Consolidation: deduped keyword table with source badges.
- Topical Map: tree/cluster of pillars → subtopics.
- Content Brief: markdown-styled doc preview.
- Content Article: long-form article preview with H1/H2 hierarchy.

### 5.13 `/dashboard/content`
Table of `contentPieces` (Title, Keyword, Pillar, Status badge, Created). Row click opens **modal/drawer**:
- For `brief` status: brief preview (objective, audience, outline, FAQs, target keywords).
- For others: article preview (rendered markdown with H1/H2/H3, paragraphs, callouts).
Modal has close X, "Edit", "Regenerate" buttons.

### 5.14 `/dashboard/leads`
Table of leads (avatar circle with initials on `bg-gradient-cta`, name, email, website, audit score, status badge, date). Row click opens **right-side drawer** (`fixed inset-0 z-40` with `max-w-md` panel) showing: profile header, business description, linked audit score card, status `<select>`, notes `<textarea>`, "Save changes" gradient button.

## 6. SEO

Every route's `head()` provides unique title (≤60 chars), description (≤160 chars), `og:title`, `og:description`. Single `<h1>` per page. Use semantic HTML (`<header>`, `<main>`, `<nav>`, `<section>`).

## 7. Build order (do these in this sequence)

1. Install deps: `bun add framer-motion lucide-react`. Confirm shadcn/ui and tw-animate-css are present.
2. Replace `src/styles.css` with §2.
3. Create `src/lib/mock-data.ts` per §3.
4. Create `Logo`, `ScoreRing`, `StatusBadge` per §4.
5. Build `__root.tsx`, then `/`, `/login`, `/audit`, `/audit/:id`.
6. Build `dashboard.tsx` layout, then dashboard children in this order: index → audits → audits/new → audits/$id → audits/$id/pipeline → keywords (all) → workflows/$workflowId → content → leads.
7. After each route, verify it renders, links resolve, and no Tailwind class is hardcoded color.

## 8. Quality bar

- No hardcoded colors (`text-white` is OK only on gradient backgrounds; otherwise use semantic tokens like `text-foreground`, `text-text-body`, `text-text-muted`, `bg-surface`, `bg-section-tint`, `border-border`, `text-brand`).
- All buttons either `bg-gradient-cta` (primary) or bordered (secondary). Never solid flat brand fills.
- All animated screens use `framer-motion` with reduced-motion-friendly durations (≤500ms unless ambient).
- Tables, drawers, and modals must work at 1280px and remain usable at 768px (sidebar collapses on `md:`).
- Strict TS — no `any`, no unused imports.
- No `react-router-dom`, no `src/pages/`, no `_app/` folder.

## 9. Acceptance checklist

- [ ] 17 route files exist; navigation between all of them works without errors.
- [ ] Pipeline screen visibly animates 15 steps with streaming logs.
- [ ] Workflow screen advances steps on Approve and shows distinct mock outputs per step.
- [ ] Lead drawer opens on row click with editable status.
- [ ] Content modal renders both brief and article variants.
- [ ] Landing page hero gradient + score card visible on first paint, no layout shift.
- [ ] Dark sidebar gradient + active gradient pill visible in dashboard.
- [ ] All status badges color-coded via `--status-*` tokens.
- [ ] No hex colors in components; only tokens/utilities.

Build it.
