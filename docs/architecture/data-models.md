# Data Models

## ORM

Drizzle ORM with PostgreSQL. Schema at `server/src/db/schema.ts`.

## Tables

| Table | Description |
|-------|-------------|
| `users` | Clerk-synced user accounts |
| `leads` | Audit submission leads |
| `audits` | Website audit records + scores |
| `keyword_projects` | Keyword research projects |
| `topical_maps` | Pillar/cluster topic maps |
| `keywords` | Individual keyword records |
| `content_pieces` | Generated content (briefs + articles) |

## Enums

| Enum | Values |
|------|--------|
| `audit_status` | pending, processing, complete, failed |
| `lead_status` | new, contacted, qualified, converted, lost |
| `keyword_intent` | transactional, commercial, informational, navigational |
| `funnel_stage` | tofu, mofu, bofu |
| `keyword_status` | discovered, approved, brief_ready, written, published |
| `content_status` | brief, draft, review, approved, published |

## Entity Relationships

```
users ──1:N──> audits
users ──1:N──> keyword_projects
leads ──1:1──> audits
keyword_projects ──1:N──> keywords
keyword_projects ──1:N──> topical_maps
keywords ──1:1──> content_pieces
```

## Keyword Fields

| Field | DB Column | Type |
|-------|-----------|------|
| Primary Keyword | `keyword` | text |
| KD | `kd` | integer |
| Search Volume | `searchVolume` | integer |
| Intent | `intent` | keyword_intent enum |
| Funnel | `funnel` | funnel_stage enum |
| Target URL | `targetUrl` | text |
| LSI Keywords | `lsiKeywords` | jsonb |

## Commands

```bash
# Push schema to database (dev)
npm run db:push

# Seed database
npm run db:seed

# Open Drizzle Studio
cd server && npx drizzle-kit studio
```
