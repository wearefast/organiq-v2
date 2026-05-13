# Feature: Workspaces & Projects

## Overview

Workspaces and Projects form the organizational hierarchy below Organizations. A workspace represents a client account, and a project represents a single domain/market being analyzed.

## Hierarchy

```
Organization (agency) — managed by Clerk
 └── Workspace (client)
      └── Project (domain/market)
           ├── Workflow Runs
           ├── Keywords
           ├── Topical Maps
           ├── Content Pieces
           └── Reports
```

## Key Files

### Workspaces

| File | Purpose |
|------|---------|
| `server/src/features/workspaces/workspaces.controller.ts` | REST API under `workspaces/` |
| `server/src/features/workspaces/workspaces.service.ts` | CRUD operations |
| `server/src/features/workspaces/workspaces.module.ts` | NestJS module |
| `frontend/src/app/(dashboard)/workspaces/page.tsx` | Workspace list (entry point) |
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/page.tsx` | Projects within workspace |

### Projects

| File | Purpose |
|------|---------|
| `server/src/features/projects/projects.controller.ts` | REST API under `projects/` |
| `server/src/features/projects/projects.service.ts` | CRUD operations |
| `server/src/features/projects/projects.module.ts` | NestJS module |

## API Endpoints

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspaces/org/:orgId` | List workspaces by organization |
| `GET` | `/workspaces/:id` | Get workspace by ID |
| `POST` | `/workspaces` | Create workspace |
| `PATCH` | `/workspaces/:id` | Update workspace |
| `DELETE` | `/workspaces/:id` | Delete workspace |

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/workspace/:workspaceId` | List projects by workspace |
| `GET` | `/projects/:id` | Get project by ID |
| `POST` | `/projects` | Create project |
| `PATCH` | `/projects/:id` | Update project |
| `DELETE` | `/projects/:id` | Delete project |

## Data Model

### workspaces table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | FK → organizations |
| name | text | Workspace name |
| slug | text | URL-friendly slug |
| domain | text | Client's primary domain (optional) |

**Unique index**: `workspaces_org_slug_idx` on `(organizationId, slug)`

### projects table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| workspaceId | UUID | FK → workspaces |
| organizationId | UUID | FK → organizations |
| name | text | Project name |
| domain | text | Target domain for SEO analysis |
| country | text | Target country (default: 'US') |
| language | text | Target language (default: 'en') |
| industry | text | Industry vertical (optional) |

## Navigation Flow

```
/workspaces                              → Workspace list
/workspaces/:wId/projects                → Project list within workspace
/workspaces/:wId/projects/:pId/keywords  → Keywords for project
/workspaces/:wId/projects/:pId/content   → Content for project
/workspaces/:wId/projects/:pId/workflows → Workflow runs for project
/workspaces/:wId/projects/:pId/reports   → Reports for project
/workspaces/:wId/projects/:pId/topical-map → Topical map for project
```

The SideNav shows only `/workspaces` as the entry point. The workspace list loads workspaces for the active organization context, the `New Workspace` action first activates or creates an organization when needed, and then opens an inline create form that routes directly to `/workspaces/:wId/projects` on success.

The projects page for a workspace now loads the current workspace through the workspaces API, lists existing projects for that workspace, and uses an inline `New Project` form to create projects through `POST /projects`. After creation, the UI routes directly to `/workspaces/:wId/projects/:pId/workflows`.
