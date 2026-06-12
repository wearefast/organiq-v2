# Frontend Architecture — Pulse OS

## Overview

Next.js 15 (App Router) with React 19, Tailwind CSS, Zustand for client state, and Clerk for authentication.

## Directory Structure

```
frontend/src/
├── app/
│   ├── layout.tsx                  Root layout (Clerk provider, fonts, theme)
│   ├── globals.css                 Tailwind + design tokens
│   ├── (dashboard)/                Authenticated route group
│   │   ├── layout.tsx              Dashboard shell (top bar, side rail)
│   │   ├── billing/
│   │   │   └── page.tsx            Subscription management (Stripe)
│   │   ├── settings/
│   │   │   └── page.tsx            User/org settings
│   │   └── workspaces/
│   │       ├── page.tsx            Workspace list
│   │       └── [wId]/
│   │           └── projects/
│   │               ├── page.tsx    Project list
│   │               └── [pId]/
│   │                   ├── overview/page.tsx      Project overview
│   │                   ├── workflows/
│   │                   │   ├── page.tsx           Workflow runs list
│   │                   │   └── [runId]/page.tsx   Workflow run detail
│   │                   ├── keywords/page.tsx      Keyword explorer
│   │                   ├── content/page.tsx       Content management
│   │                   ├── topical-map/page.tsx   Topical map viewer
│   │                   ├── reports/page.tsx       Reports list
│   │                   ├── research/page.tsx      Research dashboard
│   │                   ├── agents/
│   │                   │   ├── page.tsx           On-demand agents
│   │                   │   └── scheduled/page.tsx Scheduled workflows
│   │                   ├── scheduled-workflows/page.tsx Scheduled workflows (alt route)
│   │                   ├── ai-search/
│   │                   │   ├── page.tsx           AI Search overview
│   │                   │   ├── llm-audit/page.tsx LLM audit dashboard
│   │                   │   ├── traffic/page.tsx   LLM traffic (alt route)
│   │                   │   └── visibility/page.tsx Prompt visibility (alt route)
│   │                   ├── analytics/
│   │                   │   ├── page.tsx           Analytics overview
│   │                   │   ├── traffic/page.tsx   LLM traffic
│   │                   │   ├── visibility/page.tsx Prompt visibility
│   │                   │   └── llm-audit/page.tsx LLM audit
│   │                   ├── technical/
│   │                   │   ├── page.tsx           Technical SEO
│   │                   │   └── llm-audit/page.tsx LLM audit detail
│   │                   └── settings/page.tsx      Project settings
│   ├── sign-in/                    Clerk sign-in
│   └── sign-up/                    Clerk sign-up
├── features/
│   ├── workflow/                   Core workflow viewer
│   │   ├── components/
│   │   │   ├── workflow-shell.tsx  Shell layout
│   │   │   ├── step-rail.tsx      Step navigation (18 steps, 4 phases)
│   │   │   ├── artifact-panel.tsx Content display area
│   │   │   ├── approval-bar.tsx   Approve/Revise/Reject controls
│   │   │   ├── reasoning-panel.tsx Agent reasoning (expandable)
│   │   │   ├── tool-call-trail.tsx Audit trail (expandable)
│   │   │   ├── progress-bar.tsx   Step timing/progress
│   │   │   └── start-run.tsx      Create new run flow
│   │   ├── renderers/             18 artifact renderers (one per step)
│   │   ├── hooks/
│   │   │   ├── use-workflow.ts    Workflow state management
│   │   │   └── use-workflow-ws.ts WebSocket connection
│   │   ├── services/
│   │   │   └── workflow.service.ts API calls
│   │   └── types.ts               WorkflowRun, Step, Artifact types
│   ├── agents/                     On-demand agents + scheduling
│   │   ├── components/
│   │   └── services/
│   ├── analytics/                  LLM traffic, audit, visibility dashboards
│   │   ├── hooks/
│   │   └── services/
│   ├── billing/                    Stripe integration
│   │   └── services/
│   ├── content/                    Content CRUD
│   │   └── services/
│   └── reports/                    Report generation/download
│       └── services/
└── shared/
    ├── components/                 Design system components
    │   ├── command-palette.tsx     ⌘K palette
    │   ├── top-bar.tsx            48px top bar
    │   ├── side-nav.tsx           56px icon rail (expands to 240px)
    │   ├── notification-bell.tsx  Notification dropdown
    │   ├── status-badge.tsx       Step/workflow status
    │   ├── button.tsx             CVA-based variants
    │   ├── card.tsx               Content containers
    │   ├── markdown-preview.tsx   Rendered markdown content
    │   ├── error-boundary.tsx     Error boundary wrapper
    │   └── ...                    (17 components total)
    ├── hooks/
    │   ├── use-notifications.ts       Notification state + polling
    │   └── use-theme.tsx              Dark/light mode
    └── utils/
        ├── api.ts                 Typed fetch wrapper (apiFetch<T>)
        ├── cn.ts                  Class name merge utility
        └── countries.ts           ISO country data
```

## Design System

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-shell` | `#0A0A0B` | Page background |
| `--bg-sidebar` | `#111113` | Side rail |
| `--bg-content` | `#18181B` | Content area |
| `--bg-elevated` | `#1F1F23` | Cards, panels |
| `--accent` | `#E11D48` (rose-600) | Primary actions |
| `--phase-1` | violet | Intelligence phase |
| `--phase-2` | blue | Research phase |
| `--phase-3` | amber | Strategy phase |
| `--phase-4` | emerald | Content phase |

### Typography

| Scale | Size | Usage |
|-------|------|-------|
| Page Title | 18px | Page headings |
| Section | 14px | Section headers |
| Body | 13px | Default text |
| Table | 12px | Data tables, labels |
| Header | 11px CAPS | Column headers |
| Badge | 10px | Status badges |

Fonts: Inter (primary), JetBrains Mono (scores, URLs, data).

### Layout

- **Top bar**: 48px fixed
- **Side rail**: 56px icon-only, expands to 240px on hover
- **Content**: Fluid, responsive
- **Workflow view**: 280px step rail (left) + artifact panel (right)

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ⌘K | Command palette |

## State Management

- **Zustand** for client-side state (workflow progress, UI preferences)
- **Server state** via fetch + SWR-like patterns (no React Query — keep simple)
- **WebSocket** for real-time step progress updates

## Auth (Clerk)

- `ClerkProvider` wraps root layout
- `(dashboard)` route group uses Clerk middleware for auth gate
- User/org data synced to backend via Clerk webhooks
- Frontend reads user + org from Clerk hooks

## API Communication

All calls through `shared/utils/api.ts`:
- Base URL: `http://localhost:3002` (dev)
- Auth: Clerk session token in Authorization header
- Error handling: Throws on non-OK, parsed JSON responses
