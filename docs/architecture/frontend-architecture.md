# Frontend Architecture

## Framework

Next.js 15 with App Router, Clerk authentication, Tailwind CSS.

## Directory Layout

```
frontend/src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (ClerkProvider)
│   ├── page.tsx                # Landing page
│   ├── audit/page.tsx          # Public audit form
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell (UserButton, nav)
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
| `/audit` | No | Public audit form |
| `/dashboard` | Yes (Clerk) | Dashboard overview |
| `/dashboard/audits` | Yes | Audit list |
| `/dashboard/keywords` | Yes | Keyword projects |
| `/dashboard/content` | Yes | Content pipeline |
| `/dashboard/leads` | Yes | Lead list |

## Auth

Clerk middleware at `src/middleware.ts` protects `/dashboard(.*)` routes. Public routes: `/`, `/audit`.

## API Communication

All API calls go through `shared/utils/api.ts` (`apiFetch()`) which prefixes `NEXT_PUBLIC_API_URL` and handles JSON serialization/error throwing. Feature-specific services wrap `apiFetch` with typed interfaces.
