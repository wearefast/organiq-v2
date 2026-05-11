# Features

## Feature Modules

| Feature | Frontend | Server | Description |
|---------|----------|--------|-------------|
| Audit | `frontend/src/features/audit/` | `server/src/features/audit/` | Public audit form, progress polling, score display |
| Dashboard | `frontend/src/features/dashboard/` | — | Stats overview cards |
| Keywords | `frontend/src/features/keywords/` | `server/src/features/keywords/` | Project management, discovery, gap analysis |
| Content | `frontend/src/features/content/` | `server/src/features/content/` | Workflow-aware brief/article handoff, persisted dashboard previews, status management |
| Leads | `frontend/src/features/leads/` | `server/src/features/leads/` | Lead capture, dashboard lead management, audit creation, queue enqueue |
| Integrations | — | `server/src/features/integrations/` | Ahrefs, SerpAPI, OpenAI, PageSpeed, Scraper |
| Webhooks | — | `server/src/features/webhooks/` | Clerk auth webhook |

## Feature Folder Convention

Each feature follows a consistent structure:

**Frontend** (`frontend/src/features/<name>/`)
```
components/     → React components (≤150 lines each)
hooks/          → Custom hooks
services/       → API call functions
utils/          → Feature-specific helpers
index.ts        → Public barrel export
```

**Server** (`server/src/features/<name>/`)
```
<name>.module.ts
<name>.controller.ts
<name>.service.ts
dto/            → Request validation DTOs
services/       → Sub-services (e.g. integrations)
```
