# Data Models — Pulse OS

## Overview

PostgreSQL 16 with Drizzle ORM. Schema defined in `server/src/db/schema.ts`.

## Entity Relationship Diagram

```
organizations ─┬─ org_members ─── (user reference via Clerk ID)
               ├─ credit_ledger
               └─ workspaces ─── projects ─── workflow_runs
                                                    │
                                              workflow_steps
                                                    │
                                    ┌───────────────┼───────────────┐
                              step_artifacts   step_approvals   step_tool_calls
                                    │
                              workflow_context
                                    │
                    ┌───────────────┼───────────────┐
                keywords      topical_maps     content_pieces
                                                      │
                                                   reports
```

## Core Tables

### organizations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| clerk_org_id | text | Clerk org reference |
| name | text | |
| slug | text | Unique |
| plan | enum | `starter`, `pro`, `agency`, `enterprise` |
| credits_balance | integer | Current credit balance |
| created_at | timestamp | |
| updated_at | timestamp | |

### org_members

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| clerk_user_id | text | Clerk user reference |
| role | enum | `owner`, `admin`, `member` |
| email | text | |
| name | text | |
| created_at | timestamp | |

### credit_ledger

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| amount | integer | Positive = credit, negative = debit |
| balance_after | integer | Running balance |
| type | enum | `purchase`, `usage`, `refund`, `bonus` |
| description | text | Human-readable reason |
| workflow_run_id | uuid | FK → workflow_runs (nullable) |
| step_key | text | Which step consumed credits (nullable) |
| created_at | timestamp | |

### workspaces

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| name | text | Client name |
| slug | text | Unique within org |
| domain | text | Primary client domain |
| created_at | timestamp | |
| updated_at | timestamp | |

### projects

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| organization_id | uuid | FK → organizations (denormalized for queries) |
| name | text | |
| domain | text | Target domain |
| country | text | ISO country code |
| language | text | ISO language code |
| industry | text | For strategy templates |
| created_at | timestamp | |
| updated_at | timestamp | |

### workflow_runs

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| status | enum | `draft`, `running`, `paused`, `completed`, `failed` |
| current_step | text | Step key currently active |
| credits_used | integer | Running total |
| started_at | timestamp | |
| completed_at | timestamp | Nullable |
| created_at | timestamp | |
| updated_at | timestamp | |

### workflow_steps

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_run_id | uuid | FK → workflow_runs |
| step_key | text | One of 18 step keys |
| step_number | integer | 1-18 |
| phase | integer | 1-4 |
| status | enum | `pending`, `running`, `completed`, `awaiting_approval`, `approved`, `revision_requested`, `rejected`, `failed`, `skipped` |
| started_at | timestamp | Nullable |
| completed_at | timestamp | Nullable |
| credits_used | integer | |
| iterations | integer | Agent iteration count |
| error | text | Nullable, on failure |
| created_at | timestamp | |
| updated_at | timestamp | |

### step_artifacts

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_step_id | uuid | FK → workflow_steps |
| workflow_run_id | uuid | FK → workflow_runs |
| step_key | text | Denormalized for queries |
| version | integer | Increment on revision |
| data | jsonb | Artifact payload |
| reasoning | text | Agent explanation |
| created_at | timestamp | |

### step_approvals

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_step_id | uuid | FK → workflow_steps |
| artifact_id | uuid | FK → step_artifacts |
| decision | enum | `approved`, `revision_requested`, `rejected` |
| notes | text | Reviewer notes |
| reviewer_id | text | Clerk user ID |
| created_at | timestamp | |

### step_tool_calls

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_step_id | uuid | FK → workflow_steps |
| tool_name | text | e.g., `ahrefs.getOrganicKeywords` |
| input | jsonb | Tool call arguments |
| output | jsonb | Tool response (truncated if large) |
| duration_ms | integer | Execution time |
| error | text | Nullable |
| created_at | timestamp | |

### workflow_context

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_run_id | uuid | FK → workflow_runs |
| key | text | Context key (e.g., `business_profile`, `seed_keywords`) |
| value | jsonb | Accumulated state |
| updated_at | timestamp | |

### keywords

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| workflow_run_id | uuid | FK → workflow_runs (nullable) |
| keyword | text | |
| volume | integer | Monthly search volume |
| difficulty | integer | KD score 0-100 |
| cpc | decimal | Cost per click |
| intent | enum | `transactional`, `commercial`, `informational`, `navigational` |
| funnel_stage | enum | `tofu`, `mofu`, `bofu` |
| status | enum | `discovered`, `approved`, `brief_ready`, `written`, `published` |
| source_step | text | Which step discovered it |
| parent_topic | text | Topical grouping |
| serp_features | jsonb | Array of SERP features present |
| created_at | timestamp | |
| updated_at | timestamp | |

### topical_maps

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| workflow_run_id | uuid | FK → workflow_runs |
| name | text | Map name |
| pillars | jsonb | Array of pillar objects with clusters |
| calendar | jsonb | Content calendar assignments |
| created_at | timestamp | |
| updated_at | timestamp | |

### content_pieces

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| keyword_id | uuid | FK → keywords (nullable) |
| workflow_run_id | uuid | FK → workflow_runs |
| type | enum | `brief`, `article` |
| status | enum | `draft`, `review`, `approved`, `published` |
| title | text | |
| brief_data | jsonb | Brief payload |
| article_data | jsonb | Article payload |
| scores | jsonb | Quality scores (readability, SEO, citability) |
| word_count | integer | |
| created_at | timestamp | |
| updated_at | timestamp | |

### reports

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| workflow_run_id | uuid | FK → workflow_runs |
| type | enum | `full_strategy`, `ai_visibility`, `keyword_research`, `content_plan` |
| title | text | |
| file_path | text | Path to generated PDF |
| generated_at | timestamp | |
| created_at | timestamp | |

## Enums

| Enum | Values |
|------|--------|
| `org_plan` | `starter`, `pro`, `agency`, `enterprise` |
| `org_role` | `owner`, `admin`, `member` |
| `credit_type` | `purchase`, `usage`, `refund`, `bonus` |
| `workflow_status` | `draft`, `running`, `paused`, `completed`, `failed` |
| `step_status` | `pending`, `running`, `completed`, `awaiting_approval`, `approved`, `revision_requested`, `rejected`, `failed`, `skipped` |
| `approval_decision` | `approved`, `revision_requested`, `rejected` |
| `keyword_intent` | `transactional`, `commercial`, `informational`, `navigational` |
| `funnel_stage` | `tofu`, `mofu`, `bofu` |
| `keyword_status` | `discovered`, `approved`, `brief_ready`, `written`, `published` |
| `content_type` | `brief`, `article` |
| `content_status` | `draft`, `review`, `approved`, `published` |
| `report_type` | `full_strategy`, `ai_visibility`, `keyword_research`, `content_plan` |

## Integration Tables

### gsc_connections

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| project_id | uuid FK (unique) | One GSC connection per project |
| organization_id | uuid FK | |
| site_url | text | Google property URL (e.g. `sc-domain:example.com`) |
| encrypted_access_token | text | AES-256-GCM encrypted |
| encrypted_refresh_token | text | AES-256-GCM encrypted |
| token_expires_at | timestamp | |
| last_sync_at | timestamp | |
| sync_status | text | `connected`, `syncing`, `synced`, `error` |
| created_at | timestamp | |
| updated_at | timestamp | |

### gsc_keyword_data

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| connection_id | uuid FK | → gsc_connections |
| project_id | uuid FK | |
| query | text | Search query |
| page | text (nullable) | Landing page URL |
| clicks | integer | |
| impressions | integer | |
| ctr | numeric | Click-through rate |
| position | numeric | Average position |
| date | date | |
| country | text (nullable) | |
| device | text (nullable) | |
| created_at | timestamp | |

## Indexes (Key)

- `workflow_steps`: compound on `(workflow_run_id, step_key)`
- `step_artifacts`: compound on `(workflow_run_id, step_key, version)`
- `keywords`: compound on `(project_id, status)`
- `credit_ledger`: compound on `(organization_id, created_at)`
- `gsc_connections`: unique on `(project_id)`
- `gsc_keyword_data`: compound on `(connection_id)`, `(project_id, date)`, `(query)`
- All FK columns indexed
