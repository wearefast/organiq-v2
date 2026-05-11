# Frontend Architecture

## Framework

Next.js 15 with App Router, demo-mode client auth, Tailwind CSS.

## Directory Layout

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (AuthProvider)
│   ├── page.tsx                # Landing page
│   ├── login/page.tsx          # Demo sign-in page
│   ├── audit/page.tsx          # Public audit form
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell + auth redirect gate
│       ├── page.tsx            # Dashboard overview
│       ├── audits/page.tsx     # Audit list
│       ├── keywords/page.tsx   # Keyword projects
│       ├── content/page.tsx    # Content pipeline
│       └── leads/page.tsx      # Lead list
├── features/
│   ├── audit/                  # Audit form, polling, score cards
│   ├── dashboard/              # Stats overview
│   ├── keywords/               # Keyword project services
│   ├── content/                # Content pipeline services and persisted preview payload types
│   └── leads/                  # Lead drawer components and dashboard mutation services
└── shared/
    ├── components/             # Button, Card (cva + tailwind-merge)
    └── utils/                  # cn(), apiFetch()
```

## Routing

| Route | Auth | Component |
|-------|------|-----------|
| `/` | No | Landing page |
| `/login` | No | Demo sign-in |
| `/audit` | No | Public audit form |
| `/dashboard` | Yes (demo session) | Dashboard overview |
| `/dashboard/audits` | Yes | Audit list |
| `/dashboard/keywords` | Yes | Keyword projects |
| `/dashboard/content` | Yes | Content pipeline |
| `/dashboard/leads` | Yes | Lead list |

## Auth

`src/shared/hooks/use-auth.tsx` provides demo-mode auth backed by `localStorage` (`pulse_auth`). `src/app/dashboard/layout.tsx` redirects unauthenticated users to `/login`. `src/middleware.ts` is currently a pass-through placeholder in demo mode. Public routes: `/`, `/login`, `/audit`.

## API Communication

All API calls go through `shared/utils/api.ts` (`apiFetch()`) which resolves a base URL from `API_URL` or `INTERNAL_API_URL` first, then falls back to `NEXT_PUBLIC_API_URL`, and handles JSON serialization/error throwing. In local development, it falls back to `http://localhost:3002` and normalizes the older `localhost:3005` dev setting back to the active Nest API port so stale shell env does not break SSR or client fetches. Feature-specific services wrap `apiFetch` with typed interfaces.

Latest dashboard API consumers:

- `features/content/services/content.service.ts` now loads both `/content` and `/content/:id` so the dashboard modal can render persisted brief/article payloads instead of static placeholders
- `features/leads/services/leads.service.ts` now calls `PATCH /leads/:id` so the dashboard drawer can persist strategist status updates and internal notes
