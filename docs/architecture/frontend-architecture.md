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
│   │   ├── page.tsx                Dashboard home
│   │   ├── workspaces/
│   │   │   ├── page.tsx            Workspace list
│   │   │   └── [id]/
│   │   │       ├── page.tsx        Workspace detail
│   │   │       └── projects/
│   │   │           ├── page.tsx    Project list
│   │   │           └── [id]/
│   │   │               ├── page.tsx        Project detail
│   │   │               └── workflows/
│   │   │                   ├── page.tsx    Workflow runs list
│   │   │                   └── [runId]/
│   │   │                       └── page.tsx  Workflow shell
│   │   ├── keywords/               Keyword ledger
│   │   ├── content/                Content management
│   │   ├── reports/                Report generation
│   │   ├── credits/                Credit management
│   │   └── settings/               Org/workspace settings
│   ├── sign-in/                    Clerk sign-in
│   └── sign-up/                    Clerk sign-up
├── features/
│   ├── workflow/                   Main workflow feature
│   │   ├── components/
│   │   │   ├── workflow-shell.tsx  Shell layout
│   │   │   ├── step-rail.tsx      Step navigation (18 steps, 4 phases)
│   │   │   ├── artifact-panel.tsx Content display area
│   │   │   ├── approval-bar.tsx   Approve/Revise/Reject controls
│   │   │   ├── reasoning-panel.tsx Agent reasoning (expandable)
│   │   │   ├── tool-call-trail.tsx Audit trail (expandable)
│   │   │   ├── progress-bar.tsx   Step timing/progress
│   │   │   └── start-run.tsx      Create new run flow
│   │   ├── renderers/             17 artifact renderers (one per step)
│   │   ├── hooks/
│   │   │   ├── use-workflow.ts    Workflow state management
│   │   │   └── use-workflow-ws.ts WebSocket connection
│   │   └── services/
│   │       └── workflow.service.ts API calls
│   ├── workspace/                  Workspace management
│   ├── project/                    Project management
│   ├── keywords/                   Keyword ledger UI
│   ├── content/                    Content editor + scoring
│   ├── reports/                    Report generation UI
│   └── credits/                    Credit display + purchase
└── shared/
    ├── components/                 Design system components
    │   ├── command-palette.tsx     ⌘K palette
    │   ├── top-bar.tsx            48px top bar
    │   ├── side-nav.tsx           56px icon rail (expands to 240px)
    │   ├── score-badge.tsx        Color-coded score display
    │   ├── status-badge.tsx       Step/workflow status
    │   ├── data-table.tsx         Reusable data table
    │   └── ...
    ├── hooks/
    │   ├── use-keyboard-shortcuts.ts  Global shortcuts
    │   ├── use-theme.ts              Dark/light mode
    │   └── ...
    └── utils/
        ├── api.ts                 Typed fetch wrapper
        └── ...
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
| J / K | Navigate steps |
| A | Approve current step |
| R | Request revision |
| E | Edit artifact (if editable) |

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
