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

## Billing

Base: `/billing`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/webhook` | Stripe webhook receiver | Stripe signature (no JWT) |
| `POST` | `/:organizationId/checkout` | Create subscription checkout session | ClerkGuard + OrgMembership |
| `POST` | `/:organizationId/purchase-credits` | Create credit pack purchase session | ClerkGuard + OrgMembership |
| `POST` | `/:organizationId/portal` | Open Stripe customer portal | ClerkGuard + OrgMembership |
| `GET` | `/:organizationId/subscription` | Get current subscription | ClerkGuard + OrgMembership |

**Checkout body:**
```json
{
  "plan": "pro" | "agency" | "enterprise",
  "successUrl": "https://app.example.com/billing?success=true",
  "cancelUrl": "https://app.example.com/billing"
}
```

**Purchase credits body:**
```json
{
  "credits": 500,
  "successUrl": "https://app.example.com/billing?success=true",
  "cancelUrl": "https://app.example.com/billing"
}
```

---

## On-Demand Agents

Base: `/projects/:projectId/agents`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/run` | Execute agent with natural-language prompt |
| `GET` | `/history` | List agent run history (`?limit=20`) |
| `GET` | `/types` | List available agent types |

**Run body:**
```json
{
  "prompt": "Analyze competitor backlink profiles for example.com",
  "agentType": "ai-intelligence"
}
```

---

## Scheduled Workflows

Base: `/projects/:projectId/scheduled-workflows`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create scheduled workflow |
| `GET` | `/` | List scheduled workflows for project |
| `GET` | `/:workflowId` | Get single scheduled workflow |
| `PATCH` | `/:workflowId` | Update scheduled workflow |
| `DELETE` | `/:workflowId` | Delete scheduled workflow |
| `GET` | `/:workflowId/history` | Get run history (`?limit=20`) |

**Create body:**
```json
{
  "name": "Weekly competitor check",
  "agentType": "ai-intelligence",
  "prompt": "Check competitor rankings for top 10 keywords",
  "scheduleCron": "0 9 * * 1",
  "deliveryChannel": "email",
  "deliveryTarget": "team@example.com"
}
```

---

## LLM Audit

Base: `/projects/:projectId/audit/llm`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/run` | Trigger a new LLM crawlability audit |
| `GET` | `/latest` | Get most recent audit results |
| `GET` | `/history` | Get historical audits for the project |

---

## LLM Traffic

Base: `/projects/:projectId/traffic` (overview/engines) + `/traffic` (ingest)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/traffic/ingest` | Ingest traffic event from pulse-tracker.js | None (public) |
| `GET` | `/projects/:projectId/traffic/overview` | Traffic overview with date range | ClerkGuard |
| `GET` | `/projects/:projectId/traffic/engines` | Supported AI engines list with colors | ClerkGuard |

---

## Notifications

Base: `/organizations/:organizationId/notifications`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List notifications (`?unreadOnly`, `?limit`) |
| `GET` | `/unread-count` | Get unread notification count |
| `PATCH` | `/:id/read` | Mark notification as read |
| `PATCH` | `/read-all` | Mark all notifications as read |
| `DELETE` | `/:id` | Delete a notification |

---

## Prompt Visibility

Base: `/projects/:projectId/prompts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List tracked prompts |
| `POST` | `/` | Create a new prompt to track |
| `DELETE` | `/:promptId` | Delete a tracked prompt |
| `PATCH` | `/:promptId/toggle` | Toggle prompt active/inactive |
| `POST` | `/:promptId/run` | Manually trigger visibility check |
| `GET` | `/:promptId/history` | Get check history for a prompt |
| `GET` | `/overview` | Project-level visibility summary |
| `GET` | `/suggestions` | AI-generated prompt suggestions |
| `GET` | `/engines` | List supported LLM engines |
| `GET` | `/schedule` | Get check schedule config |
| `PATCH` | `/schedule` | Update schedule hour (0–23) |

---

## Google Search Console (GSC)

Base: `/projects/:projectId/gsc`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/connect` | Initiate OAuth flow → Google consent | ClerkGuard |
| `GET` | `/callback` | OAuth callback (exchanges code for tokens) | None (redirect) |
| `GET` | `/status` | Connection status (connected, siteUrl, lastSync) | ClerkGuard |
| `GET` | `/keywords` | GSC keyword data (`?startDate`, `?endDate`, `?limit`) | ClerkGuard |
| `GET` | `/summary` | Aggregated performance summary (last 28 days) | ClerkGuard |

---

## Keywords — Decay Alerts

Base: `/projects/:projectId/keywords/decay`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/alerts` | Get decay alerts (`?includeResolved`, `?limit`) |
| `PATCH` | `/alerts/:alertId/resolve` | Resolve a decay alert |

---

## Prompt Visibility

Base: `/projects/:projectId/prompts`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List tracked prompts |
| `POST` | `/` | Create tracked prompt |
| `GET` | `/:id/results` | Get visibility results for prompt |

---

## Notifications

Base: `/organizations/:organizationId/notifications`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List notifications |
| `PATCH` | `/:id/read` | Mark notification as read |

---

## Admin

Base: `/admin`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dlq` | List dead-letter queue failures |
| `POST` | `/dlq/:id/replay` | Re-enqueue failed job |
| `POST` | `/dlq/:id/dismiss` | Mark failure as resolved |

---

## Frontend Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Auth redirect |
| `/login` | Login | Clerk sign-in |
| `/billing` | Billing | Plan cards, credit packs, portal |
| `/settings` | Settings | Profile, org info, security |
| `/workspaces` | Workspaces | Workspace list (entry point) |
| `/workspaces/:id/projects` | Projects | Project list within workspace |
| `/workspaces/:wId/projects/:pId/overview` | Overview | Project dashboard |
| `/workspaces/:wId/projects/:pId/ai-search` | AI Search | AI visibility tracking |
| `/workspaces/:wId/projects/:pId/analytics` | Analytics | Traffic & performance |
| `/workspaces/:wId/projects/:pId/technical` | Technical | Technical SEO audit |
| `/workspaces/:wId/projects/:pId/agents` | Agents | On-demand agent interface |
| `/workspaces/:wId/projects/:pId/content` | Content | Content pieces list/editor |
| `/workspaces/:wId/projects/:pId/research` | Research | Keywords, topical maps |
| `/workspaces/:wId/projects/:pId/settings` | Settings | Project settings |
| `/workspaces/:wId/projects/:pId/keywords` | Keywords | Keyword management |
| `/workspaces/:wId/projects/:pId/topical-map` | Topical Map | Topical structure viewer |
| `/workspaces/:wId/projects/:pId/workflows` | Workflows | Workflow run list |
| `/workspaces/:wId/projects/:pId/workflows/:runId` | Run Detail | Step-by-step view + approval |
| `/workspaces/:wId/projects/:pId/reports` | Reports | Report list + generator |

---

## Swagger

Interactive API documentation is available at `http://localhost:3002/docs` when the backend is running. All controllers are tagged and documented via `@nestjs/swagger` decorators.
