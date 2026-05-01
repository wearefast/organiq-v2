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
│   └── content/                # Content pipeline services
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

All API calls go through `shared/utils/api.ts` (`apiFetch()`) which prefixes `NEXT_PUBLIC_API_URL` and handles JSON serialization/error throwing. In local development, it falls back to `http://localhost:3002` so the frontend talks to the Nest API even when the env var is unset. Feature-specific services wrap `apiFetch` with typed interfaces.
