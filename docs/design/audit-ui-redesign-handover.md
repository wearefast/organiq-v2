# Audit Section UI Redesign — Design Handover

> **Prepared by**: UI/UX Design  
> **For**: Principal Frontend Engineer  
> **Date**: May 8, 2026  
> **Objective**: Bring the Audit section (list page, results page, pipeline page, new-audit page) to the same design quality, user journey coherence, and component consistency as the Keyword Research section.

---

## 1. Product Context & Audience

| | Audit Section | Keywords Section |
|---|---|---|
| **Who uses it** | Lead prospects (public), internal strategists (dashboard) | Internal strategists only |
| **Primary goal** | Fast diagnostic, lead capture, trust-building | Deep research workflow, checkpoint-by-checkpoint approval |
| **Emotional tone** | "Impressive at a glance" — premium, polished, scannable | "Professional workspace" — structured, productive, tool-grade |
| **Current maturity** | Functional but dated — first-pass UI, no shared patterns | Polished — consistent cards, rail, forms, status badges |

Both share the same user persona once inside the dashboard: an SEO strategist reviewing data. The Audit results page currently feels like a different product from the Keywords workspace.

---

## 2. Reference Design System (Extracted from Keywords Section)

The Keywords section has established the de-facto design language. All patterns below should be treated as the source of truth.

### 2.1 Layout Patterns

| Pattern | Keywords Implementation | Audit Current State |
|---|---|---|
| **Page header** | `text-[32px] font-bold` title + `text-sm text-[#9CA3AF]` subtitle + right-aligned primary CTA | Audit list matches. Results page uses gradient hero instead — inconsistent with dashboard context |
| **Content cards** | `rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm` | Results uses same `Card` pattern ✅ but inconsistently — some cards lack icon, some use different padding |
| **Two-column grid** | `grid gap-5 lg:grid-cols-2` for related panels | Results uses this ✅ |
| **Collapsible panels** | `CollapsiblePanel` component with chevron rotation | Not used in audit results — could improve long sections |
| **Side-rail + content** | `WorkflowShellLayout` — collapsible sidebar + scrollable main | Pipeline page has no navigation structure |

### 2.2 Component Inventory

| Component | Keywords | Audit Equivalent | Gap |
|---|---|---|---|
| **Status badges** | `rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]` | Audit list uses `rounded-full px-2 py-0.5` — smaller, different sizes | Standardize to Keywords sizing |
| **Pill tags** (seed keywords) | `rounded-full border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-1 text-xs text-[#344054]` | Audit uses `rounded-pill bg-[#FCF4F6] px-3 py-1 text-sm text-[#DA304F]` for seeds | Harmonize — use neutral pill for data, colored pill only for emphasis |
| **Action buttons** | `bg-[#111827] text-white rounded-lg` (primary), `border border-[#D0D5DD] bg-white` (secondary) | Results page buttons match ✅ | — |
| **Generate button** | `bg-[#6366F1] text-white rounded-lg` with progress bar | No equivalent in audit (audit is automated) | — |
| **Table headers** | `text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]` | Audit tables match ✅ | — |
| **Table rows** | `border-b border-[#F3F4F6] hover:bg-[#FAFAFB]` | Audit list uses `border-b border-[#E8EAF0] hover:bg-[#F8F9FC]` | Slightly different border/hover — standardize |
| **Empty state** | `rounded-xl border bg-white p-12 text-center shadow-sm` | Audit has no empty state for sections (just hides them) | Add empty states |
| **Error state** | `rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6 shadow-sm` | Audit detail uses plain `text-destructive` | Upgrade to card-based error |
| **Loading state** | (Keywords uses RSC — no client-side loader on main page) | Audit detail shows `Loading audit data...` as plain text | Upgrade to skeleton/spinner pattern |
| **Progress indicator** | Keywords `GenerateStepButton` shows inline progress bar (`h-1.5 bg-[#6366F1]`) | Audit pipeline has full-page dark theme — intentionally different | Keep pipeline different (it's a showpiece), but add progress badges to the audit list |
| **Section card header** | Icon + `text-[15px] font-semibold` side by side, `mb-4` | Same ✅ | — |
| **DL/DT metadata blocks** | `text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]` label, `text-sm text-[#4B5563]` value | Same ✅ | — |

### 2.3 Color Tokens

| Token | Value | Usage |
|---|---|---|
| **Page bg** | `#F8F9FC` | Dashboard shell |
| **Card bg** | `#FFFFFF` | All content cards |
| **Card border** | `#E8EAF0` | Default card border |
| **Primary text** | `#111827` | Headings, table cell text |
| **Secondary text** | `#4B5563` | Body copy, descriptions |
| **Muted text** | `#9CA3AF` | Labels, timestamps, placeholders |
| **Label text** | `#667085` | Uppercase tracking labels (Keywords convention) |
| **Brand red** | `#DA304F` | CTA gradient, audit branding, links in audit list |
| **Navy** | `#071932` | Tab active bg, hero bg, pipeline bg |
| **Indigo** | `#6366F1` | Generate buttons, intent badges, money keywords |
| **Teal/Green** | `#10B981` / `#12B76A` | Good scores, complete states |
| **Amber** | `#F59E0B` / `#D97706` | Warning, medium scores |
| **Red** | `#DA304F` / `#B42318` | Errors, poor scores |

### 2.4 Typography Scale

| Use | Keywords Standard |
|---|---|
| Page title | `text-[32px] font-bold text-[#111827]` |
| Section/card title | `text-[15px] font-semibold text-[#111827]` or `text-lg font-semibold` |
| Uppercase label | `text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]` |
| Body text | `text-sm text-[#4B5563]` or `text-sm text-[#667085]` |
| Table cell | `text-sm` |
| Badge / pill | `text-xs font-medium` |
| Stat number (large) | `text-[26px] font-bold` or `text-[28px] font-bold` |

---

## 3. Gap Analysis — Page by Page

### 3.1 Audit List Page (`/dashboard/audits`)

**Current state**: Basic `<table>` with minimal styling. No page-level description. No "New audit" CTA next to the title. No empty state. No loading skeleton. All score columns show "—".

**Gaps vs Keywords list page**:

| Gap | Priority | Detail |
|---|---|---|
| **No page header CTA** | P1 | Keywords has `New project` button right-aligned next to heading. Audit has no `New audit` beside the title — only in the top nav. |
| **No empty state** | P1 | When 0 audits exist, page shows nothing. Keywords shows a centered empty-state card with CTA. |
| **No loading skeleton** | P2 | Client-side `useEffect` fetch shows "Loading audits..." as plain text. Should be a shimmer/skeleton pattern inside the table card. |
| **Flat table, no cards** | P2 | Keywords list shows rich project cards with seed-keyword pills, nested workspace card, and run badges. Audit list is a raw table — works for dense data, but lacks visual hierarchy. Consider a dual-view (table + card toggle) or enrich the table rows. |
| **Scores always "—"** | P1 (data) | SEO/GEO/AEO columns are never populated despite `scores` in the schema. Either populate or remove columns. Empty columns erode trust. |
| **No status filter/search** | P3 | As audit volume grows, no filtering. Keywords doesn't have this yet either, but audits accumulate faster (lead magnet). |
| **Table lacks favicon/brand** | P2 | Each row could show the website favicon for visual recognition (data is available from `AuditDetailResponse.favicon`). |
| **No "processing" live indicator** | P2 | Processing audits show a static badge. Keywords `GenerateStepButton` shows a live progress bar. Audit list should show a pulsing/spinning indicator for PROCESSING rows and link to the pipeline page. |

**Recommended redesign**:

```
┌────────────────────────────────────────────────────────┐
│  Audits                               [ + New audit ]  │
│  Track all audit reports and their status.             │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔍 Search by domain...          [Status ▾] [Date]│  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 🌐 www.seleo.com   ● Complete  5 | — | —  May 4 │  │
│  │ 🌐 itscarbone.com  ● Complete  — | — | —  May 1 │  │
│  │ 🌐 eideal.com      ⟳ Running   — | — | —  May 1 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 3.2 Audit Results Page (`/dashboard/audits/[id]`)

**Current state**: Well-structured with hero header, quick stats strip, tab bar, and per-tab content. This is the most polished audit page. However, several patterns diverge from the Keywords workspace.

**Gaps vs Keywords workspace**:

| Gap | Priority | Detail |
|---|---|---|
| **Gradient hero header in dashboard context** | P1 | The gradient hero (`from-[#071932] via-[#AE213E] to-[#DA304F]`) is great for the public `/audit/[id]` route (lead-facing). Inside the dashboard, it clashes with the neutral `#F8F9FC` shell and looks like a different app. **Recommendation**: Use a more restrained header inside dashboard — domain + status badge + download actions in a `border-[#E8EAF0] bg-white` card, keep gradient for public-facing only. |
| **Tab navigation** | P2 | The tab bar pattern (`rounded-xl border bg-white p-1` with active `bg-[#071932] text-white`) is unique to audit results. Keywords uses a sidebar rail for navigation. For the dashboard audit detail, this tab pattern is acceptable (the data is one-shot, not a multi-step workflow), but the active tab color `#071932` should at minimum match the Keywords accent or use the shared button styling. |
| **Loading state** | P1 | `Loading audit data...` as plain text centered on page. Should use a proper skeleton — at minimum the same spinner pattern from the dashboard layout + a card skeleton for the content area. |
| **Error state** | P1 | `text-destructive` in a bare centered `<p>`. Should use the card-based error pattern: `rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6`. |
| **No breadcrumb / back navigation** | P2 | Keywords workspace shows `Back to all projects` link. Audit detail has no way back except the sidebar. Add a breadcrumb: `Audits / www.seleo.com`. |
| **Download/Email buttons** | P3 | These action buttons only appear in the hero. If we flatten the hero for dashboard, they should move to the page header area (next to the title, right-aligned like Keywords' "New project" button). |
| **Quick stats strip** | P3 | The gradient text on stat numbers (`bg-gradient-to-r bg-clip-text text-transparent`) is visually striking but is not used anywhere in Keywords. Keywords uses solid `text-[#111827]` for stat values. Decide: adopt gradient stats across both, or flatten to solid. Recommendation: keep gradient for the public route, use solid in dashboard for consistency. |

### 3.3 Pipeline Page (`/dashboard/audits/[id]/pipeline`)

**Current state**: Dark-themed "control room" with animated steps, telemetry panel, and log. This is intentionally a showpiece for the lead-facing experience.

**Assessment**: The pipeline is the one area where a divergent design is justified — it's a dramatic reveal experience. However:

| Gap | Priority | Detail |
|---|---|---|
| **Dashboard context integration** | P2 | Currently does `-mx-8 -my-8` to bleed into the dashboard shell's padding and goes full-dark. This works but breaks the dashboard layout frame. Consider a slightly less aggressive bleed — keep the sidebar visible and use the dark theme only for the content area. |
| **No abort/cancel** | P3 | User cannot cancel a running audit. Not a design system issue, but a UX gap. |
| **No back button** | P2 | Only escape is the sidebar nav. Add a subtle back link in the dark theme header area. |

### 3.4 New Audit Page (`/dashboard/audits/new`)

**Current state**: Simple form card, well-structured. Closely follows the Keywords `new` page pattern.

**Gaps**:

| Gap | Priority | Detail |
|---|---|---|
| **No "Back to audits" button** | P1 | Keywords `new` page has `Back to projects` link (outline button, right-aligned in header). Audit `new` page has no back navigation. |
| **Submit button style** | P2 | Uses `rounded-pill bg-gradient-cta` (brand gradient). Keywords `new` uses `rounded-lg bg-[#111827]` (navy solid). Should standardize — in the dashboard, use the navy solid style; save the brand gradient for public-facing forms. |
| **Form card max width** | P3 | `max-w-lg` matches Keywords. ✅ |
| **Focus ring color** | P3 | Audit form uses `focus:border-[#DA304F] focus:ring-[#DA304F]` (brand red). Keywords uses `focus:border-[#111827] focus:ring-[#111827]` (navy). Standardize to navy within the dashboard. |

---

## 4. User Journey Comparison

### Keywords Journey (current — good)
```
List page          →  Project workspace     →  Start workflow      →  Workflow shell
(project cards)       (overview + runs)        (country select)       (rail + main content)
                                                                      ↓
                                                                    Step-by-step
                                                                    (generate, review,
                                                                     approve checkpoints)
                                                                      ↓
                                                                    Consolidated outputs
                                                                    (keywords, topical map,
                                                                     content generation)
```

**What works**: Clear hierarchy. Each level gives the user a sense of where they are. The sidebar rail provides constant orientation. Status badges and progress bars show what's done vs pending.

### Audit Journey (current — needs work)
```
List page          →  View (results)
(flat table)           (tabs: overview, keywords, competitors, content gap, performance)
     or
                   →  Pipeline (processing)
                       (dark full-screen animation)
                       → auto-redirect to results on completion
```

**Problems**:
1. **No intermediate "project" level**: User goes from a flat table directly into a full results page. No sense of workspace ownership.
2. **No orientation while viewing results**: Tabs help, but there's no persistent breadcrumb or back path.
3. **Table → Rich results is a jarring transition**: The list page is spartan; the results page is heavy. Keywords eases you in through project cards → workspace → workflow.
4. **No "re-run" or comparison**: You can't compare two audits for the same domain side by side. Each audit is an island.

### Recommended Audit Journey (proposed)
```
List page           →  Audit detail page
(enriched table         (header card: domain, status, date, scores)
 with favicons,          ↓
 status pills,          Tab content
 score previews)        (same tabs, but with consistent card styling)
                        ↓
                       Actions: Download PDF | Email | Re-run audit
```

Key changes:
- Keep the flat list (it's appropriate for audits — they're many and quick-scan), but enrich it
- Add breadcrumb on the detail page
- Replace the gradient hero with a restrained header card when inside the dashboard
- Keep gradient hero for the public `/audit/[id]` page (lead-facing)

---

## 5. Specific Component Alignment Specs

### 5.1 Loading States

**Current (Audit)**:
```tsx
// Plain text — no visual weight
<p className="text-sm text-[#9CA3AF]">Loading audit data...</p>
```

**Target (match Keywords/Dashboard pattern)**:
```tsx
// Spinner + text in a centered card
<div className="flex items-center justify-center p-12">
  <div className="flex items-center gap-3 text-[#9CA3AF]">
    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <span className="text-sm font-medium">Loading audit data...</span>
  </div>
</div>
```

### 5.2 Error States

**Current (Audit)**:
```tsx
<p className="text-destructive">{error}</p>
```

**Target**:
```tsx
<div className="rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6 shadow-sm">
  <p className="text-sm text-[#B42318]">{error}</p>
</div>
```

### 5.3 Empty States

**Current (Audit list)**: None — just a bare "No audits yet" text.

**Target (match Keywords empty state)**:
```tsx
<div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
  <p className="text-sm text-[#9CA3AF]">
    No audits yet. Run your first audit to see results here.
  </p>
  <Link href="/dashboard/audits/new" className="mt-6 inline-flex ...">
    Start your first audit
  </Link>
</div>
```

### 5.4 Table Row Hover

**Current (Audit list)**:
```tsx
<tr className="border-b border-[#E8EAF0] last:border-b-0 hover:bg-[#F8F9FC]">
```

**Target (match Keywords/Results tables)**:
```tsx
<tr className="border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAFB]">
```

### 5.5 Status Badges (standardize)

**Shared status badge primitive**:
```tsx
// ✅ Good — matches Keywords pattern
<span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-medium text-[#166534]">Complete</span>

// Current audit list — too small
<span className="rounded-full px-2 py-0.5 text-xs font-medium ...">Complete</span>
// ↑ px-2 py-0.5 is tighter than px-3 py-1 — standardize to Keywords sizing
```

---

## 6. Priority Implementation Plan

### Phase 1 — Quick Wins (no new components, just alignment)

| # | Task | Files | Effort |
|---|---|---|---|
| 1 | Add "Back to audits" link on `new` page header | `audits/new/page.tsx` | S |
| 2 | Upgrade loading state on audit detail pages to spinner pattern | `audits/[id]/page.tsx`, `dashboard/audits/[id]/page.tsx` | S |
| 3 | Upgrade error state on audit detail pages to card-based pattern | Same as above | S |
| 4 | Standardize status badge sizes in audit list | `audit-list.tsx` | S |
| 5 | Standardize table row borders/hover in audit list | `audit-list.tsx` | S |
| 6 | Add page header CTA "New audit" next to "Audits" heading | `dashboard/audits/page.tsx` | S |
| 7 | Add proper empty state to audit list | `audit-list.tsx` | S |
| 8 | Standardize focus ring colors in new audit form (red → navy) | `audits/new/page.tsx` | S |
| 9 | Add breadcrumb on dashboard audit detail | `dashboard/audits/[id]/page.tsx` | S |

### Phase 2 — Structural Improvements

| # | Task | Files | Effort |
|---|---|---|---|
| 10 | Create separate `AuditResultsDashboard` wrapper that uses a restrained header card (no gradient) while keeping `AuditResults` with gradient for the public `/audit/[id]` route | `audit-results.tsx`, `dashboard/audits/[id]/page.tsx` | M |
| 11 | Add favicon display in audit list table | `audit-list.tsx`, potentially `audit.service.ts` | M |
| 12 | Add PROCESSING row live indicator (pulsing badge + link to pipeline) | `audit-list.tsx` | M |
| 13 | Add a `Back to audits` link on the pipeline page (dark-themed, subtle) | `pipeline/page.tsx` | S |
| 14 | Standardize submit button style on new audit page (pill → rounded-lg navy) | `audits/new/page.tsx` | S |

### Phase 3 — UX Enhancements

| # | Task | Files | Effort |
|---|---|---|---|
| 15 | Add search/filter to audit list (domain search, status filter) | `audit-list.tsx` | M |
| 16 | Add "Re-run audit" button on completed audit detail | `audit-results.tsx`, controller | M |
| 17 | Populate SEO/GEO/AEO scores on audit list (requires backend fix) | `audit.controller.ts`, schema | M |
| 18 | Add skeleton loading for audit list (instead of "Loading audits...") | `audit-list.tsx` | M |

---

## 7. Do NOT Change

| Item | Reason |
|---|---|
| **Pipeline dark theme** | Intentionally dramatic — key part of the lead experience |
| **Public `/audit/[id]` gradient hero** | Lead-facing — should remain impressive |
| **Tab navigation on results page** | Appropriate for one-shot data view (vs Keywords rail which is for multi-step workflow) |
| **Audit results table structure** | The `<table>` approach for keyword/competitor/content-gap data is correct for dense scannable data |
| **PDF report layout** | Separate design concern — works well as-is |

---

## 8. Shared Component Extraction Candidates

After this alignment, consider extracting these shared primitives to `shared/components/`:

| Component | Current Location | Usage |
|---|---|---|
| `StatusBadge` | Inline in both `audit-list.tsx` and keyword pages | Status indicators everywhere |
| `PageHeader` | Repeated pattern in every page | Title + subtitle + right CTA |
| `EmptyState` | Keywords inline, Audit missing | Any list that can be empty |
| `LoadingSpinner` | Dashboard layout inline | Loading states |
| `ErrorCard` | Keywords inline | Error states |
| `DataTable` + `Th` | Audit results inline | Keyword tables, competitor tables, gap tables |
| `BreadcrumbBar` | Not yet built | Dashboard sub-pages |
| `MetricCard` | Audit `QuickStats` + Keywords stats | Quick-scan numbers |

**Note**: Only extract when actually needed across 2+ features. Do not pre-extract.

---

## 9. Design Decisions Requiring Product Input

| Decision | Options | Recommendation |
|---|---|---|
| Dashboard audit header: gradient or flat? | A) Keep gradient everywhere. B) Flat in dashboard, gradient in public. | **B** — dashboard should feel like a tool, not a landing page |
| Score columns in audit list: populate or remove? | A) Fix backend to populate. B) Remove columns until backend is ready. | **A** — these are the highest-value scannable data points |
| Audit list: table or cards? | A) Keep table (dense, scannable). B) Switch to cards (richer). C) Both with toggle. | **A** — audits are high-volume, table is correct; just enrich with favicons and status pills |
| Submit button style in dashboard forms | A) Brand gradient pill. B) Navy solid rounded-lg. | **B** — consistent with Keywords; save gradient for public CTA |

---

## 10. Files Involved (Audit Frontend)

| File | Role |
|---|---|
| [audit-list.tsx](frontend/src/features/audit/components/audit-list.tsx) | Dashboard audit list table |
| [audit-results.tsx](frontend/src/features/audit/components/audit-results.tsx) | Full results page (tabs, cards, tables) |
| [audit-pipeline.tsx](frontend/src/features/audit/components/audit-pipeline.tsx) | Live analysis control room |
| [audit-form.tsx](frontend/src/features/audit/components/audit-form.tsx) | Public audit submission form |
| [audit-progress.tsx](frontend/src/features/audit/components/audit-progress.tsx) | Simple progress card (legacy, replaced by pipeline) |
| [audit-score-cards.tsx](frontend/src/features/audit/components/audit-score-cards.tsx) | Score grid (used post-completion) |
| [pipeline-step.tsx](frontend/src/features/audit/components/pipeline-step.tsx) | Individual pipeline step card |
| [country-select.tsx](frontend/src/features/audit/components/country-select.tsx) | Shared country picker |
| [pdf-report.tsx](frontend/src/features/audit/components/pdf-report.tsx) | PDF generation (no UI changes needed) |
| [dashboard/audits/page.tsx](frontend/src/app/dashboard/audits/page.tsx) | Audit list page shell |
| [dashboard/audits/new/page.tsx](frontend/src/app/dashboard/audits/new/page.tsx) | New audit form page |
| [dashboard/audits/[id]/page.tsx](frontend/src/app/dashboard/audits/%5Bid%5D/page.tsx) | Audit detail page |
| [dashboard/audits/[id]/pipeline/page.tsx](frontend/src/app/dashboard/audits/%5Bid%5D/pipeline/page.tsx) | Pipeline view page |
| [audit/page.tsx](frontend/src/app/audit/page.tsx) | Public audit landing |
| [audit/[id]/page.tsx](frontend/src/app/audit/%5Bid%5D/page.tsx) | Public audit detail |
