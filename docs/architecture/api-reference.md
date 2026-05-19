# API Reference

Complete REST API surface for the Pulse OS backend (NestJS, port 3002).

All endpoints except `/webhooks/clerk` and `/health` require authentication via Clerk JWT.

---

## Health

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Liveness check | None |

---

## Webhooks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/webhooks/clerk` | Clerk event receiver (org/membership) | Svix signature |

---

## Organizations

Base: `/organizations`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:id` | Get organization by internal UUID |
| `PATCH` | `/:id` | Update organization |
| `GET` | `/:id/members` | List organization members |

---

## Workspaces

Base: `/workspaces`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/org/:orgId` | List workspaces by organization |
| `GET` | `/:id` | Get workspace by ID |
| `POST` | `/` | Create workspace |
| `PATCH` | `/:id` | Update workspace |
| `DELETE` | `/:id` | Delete workspace |

---

## Projects

Base: `/projects`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/workspace/:workspaceId` | List projects by workspace |
| `GET` | `/:id` | Get project by ID |
| `POST` | `/` | Create project |
| `PATCH` | `/:id` | Update project |
| `DELETE` | `/:id` | Delete project |

---

## Workflows

Base: `/workflows`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create workflow run |
| `POST` | `/:id/start` | Start workflow execution |
| `GET` | `/:id` | Get run with all steps |
| `GET` | `/project/:projectId` | List runs by project |
| `POST` | `/:id/steps/:stepKey/approve` | Approve step output |
| `POST` | `/:id/steps/:stepKey/revise` | Request step revision |
| `POST` | `/:id/steps/:stepKey/reject` | Reject step output |

---

## Keywords

Base: `/projects/:projectId/keywords`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List keywords (optional `?status=` filter) |
| `GET` | `/stats` | Keyword statistics |
| `GET` | `/:id` | Get single keyword |
| `POST` | `/bulk` | Bulk upsert keywords |
| `PATCH` | `/status` | Batch update keyword status |
| `DELETE` | `/:id` | Delete keyword |

---

## Content

Base: `/projects/:projectId/content`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List content pieces |
| `GET` | `/stats` | Content statistics |
| `GET` | `/:id` | Get single content piece |
| `POST` | `/` | Create content piece |
| `POST` | `/bulk` | Bulk create content pieces |
| `PATCH` | `/:id` | Update content piece |
| `PATCH` | `/:id/status` | Update content status |

---

## Topical Maps

Base: `/projects/:projectId/topical-maps`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List topical maps |
| `GET` | `/stats` | Topical map statistics |
| `GET` | `/:id` | Get single map |
| `POST` | `/` | Create map |
| `PATCH` | `/:id` | Update map |
| `DELETE` | `/:id` | Delete map |

---

## Reports

Base: `/projects/:projectId/reports`

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/` | List reports | `Report[]` |
| `GET` | `/:id` | Get report metadata | `Report` |
| `POST` | `/generate` | Generate report | `Report` (with pageCount, fileSizeBytes) |
| `GET` | `/:id/download` | Download PDF | `{ base64: string, title: string }` |
| `DELETE` | `/:id` | Delete report | `{ deleted: boolean }` |

**Generate body:**
```json
{
  "workflowRunId": "uuid",
  "type": "full_strategy" | "ai_visibility" | "keyword_research" | "content_plan"
}
```

---

## Credits

Base: `/credits`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:organizationId/balance` | Get credit balance → `{ balance: number }` |
| `GET` | `/:organizationId/transactions` | List credit ledger entries |
| `POST` | `/:organizationId/purchase` | Purchase credits |

---

## Frontend Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Auth redirect |
| `/login` | Login | Clerk sign-in |
| `/settings` | Settings | Profile, org info, security |
| `/workspaces` | Workspaces | Workspace list (entry point) |
| `/workspaces/:id/projects` | Projects | Project list within workspace |
| `/workspaces/:wId/projects/:pId/keywords` | Keywords | Keyword management |
| `/workspaces/:wId/projects/:pId/content` | Content | Content pieces list/editor |
| `/workspaces/:wId/projects/:pId/topical-map` | Topical Map | Topical structure viewer |
| `/workspaces/:wId/projects/:pId/workflows` | Workflows | Workflow run list |
| `/workspaces/:wId/projects/:pId/workflows/:runId` | Run Detail | Step-by-step view + approval |
| `/workspaces/:wId/projects/:pId/reports` | Reports | Report list + generator |

---

## Swagger

Interactive API documentation is available at `http://localhost:3002/docs` when the backend is running. All controllers are tagged and documented via `@nestjs/swagger` decorators.
