# Backend Architecture

## Framework

NestJS 10 with feature-based module organisation.

## Directory Layout

```
server/src/
├── main.ts                     # Bootstrap (CORS, ValidationPipe, Swagger)
├── app.module.ts               # Root module
├── db/
│   ├── schema.ts               # Drizzle schema (tables, enums, relations)
│   ├── index.ts                # Drizzle client instance
│   └── seed.ts                 # Dev seed data
├── features/
│   ├── leads/                  # Lead capture + audit kickoff
│   ├── audit/                  # Audit status + progress
│   ├── keywords/               # Keyword projects + discovery
│   ├── content/                # Content briefs + articles
│   ├── integrations/           # External API services
│   └── webhooks/               # Clerk auth webhook
└── shared/
    ├── database/               # Global DatabaseModule (Drizzle)
    ├── health/                 # GET /health
    └── types/                  # Shared TypeScript types
```

## API Endpoints

Base URL: `http://localhost:3001` (dev) | Swagger: `/docs`

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |

### Leads (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/leads` | No | Submit audit request (lead magnet) |
| GET | `/leads` | Yes | List all leads |
| GET | `/leads/:id` | Yes | Get lead by ID |
| PATCH | `/leads/:id` | Yes | Update lead status and internal notes |

**POST /leads** body:
```json
{
  "websiteUrl": "https://example.com",
  "name": "Jane Smith",
  "email": "jane@company.com",
  "businessDescription": "Digital marketing agency focused on B2B SaaS"
}
```

**PATCH /leads/:id** body:
```json
{
  "status": "qualified",
  "notes": "Prioritized for strategist follow-up after audit review."
}
```

`PATCH /leads/:id` normalizes the status to the server enum and stores dashboard notes under `businessDetails.internalNotes` on the lead record.

### Audits

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/audits/:id/status` | No | Poll audit progress |
| GET | `/audits` | Yes | List all audits |
| GET | `/audits/:id` | Yes | Get audit by ID |

### Keywords

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/keywords/projects` | Yes | Create keyword project |
| GET | `/keywords/projects` | Yes | List projects |
| GET | `/keywords/projects/:id` | Yes | Get project with keywords |
| GET | `/keywords/projects/:id/keywords` | Yes | Get keywords (filterable) |
| POST | `/keywords/projects/:id/discover` | Yes | Trigger keyword discovery |
| POST | `/keywords/projects/:id/gap-analysis` | Yes | Trigger content gap analysis |

### Content

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/content` | Yes | List content pieces |
| GET | `/content/:id` | Yes | Get content piece with persisted brief, article input, and draft-body data |
| POST | `/content/generate-brief/:keywordId` | Yes | Generate content brief |
| POST | `/content/generate-article/:keywordId` | Yes | Generate full article |
| PATCH | `/content/:id/status` | Yes | Update content status |

### Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/clerk` | Svix signature | Clerk auth webhook |

## BullMQ Queues

| Queue | Jobs |
|-------|------|
| `audit-queue` | Full 11-step audit pipeline |
| `keyword-queue` | `discover`, `expand`, `gap-analysis` |
| `content-queue` | `generate-brief`, `generate-article` |
