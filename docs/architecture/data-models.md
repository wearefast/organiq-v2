# Data Models — Pulse OS

## Overview

PostgreSQL 16 with Drizzle ORM. Schema defined in `server/src/db/schema.ts`.

## Entity Relationship Diagram

```
organizations ─┬─ org_members ─────────── access_grants
               ├─ credit_ledger
               ├─ invitations
               ├─ subscriptions ─── (Stripe billing)
               ├─ purchases ─── (one-time credit packs)
               ├─ notifications
               └─ workspaces ─┬─ workspace_credit_limits
                              └─ projects ─┬─ workflow_runs
                                            │       │
                                            │  workflow_steps
                                            │       │
                                            │  ┌────┼────┐
                                            │  artifacts  approvals  tool_calls
                                            │       │
                                            │  workflow_context
                                            │       │
                                            ├─ keywords ─── keyword_decay_alerts
                                            ├─ topical_maps
                                            ├─ content_pieces ─── content_images
                                            ├─ forum_topics ─── forum_opportunities
                                            ├─ project_assets
                                            ├─ reports
                                            ├─ agent_runs
                                            ├─ scheduled_workflows ─── workflow_run_history
                                            ├─ llm_traffic_sessions / llm_traffic_stats
                                            ├─ llm_audit_results
                                            ├─ tracked_prompts ─── prompt_visibility_results
                                            └─ gsc_connections ─── gsc_keyword_data
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
| role | enum | `owner`, `admin`, `user` (renamed from `member`) |
| email | text | |
| name | text | |
| created_at | timestamp | |

### credit_ledger

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| workspace_id | uuid | FK → workspaces (nullable — for workspace-scoped debits) |
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
| business_profile | jsonb | Cached business profile data (nullable) |
| business_profile_updated_at | timestamp | Nullable |
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
| `org_role` | `owner`, `admin`, `user` (renamed from `member`) |
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
| `subscription_status` | `active`, `past_due`, `canceled`, `trialing`, `incomplete` |
| `agent_run_status` | `running`, `completed`, `failed` |

## Billing Tables

### subscriptions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| stripe_subscription_id | text | Unique |
| stripe_customer_id | text | |
| stripe_price_id | text | Active price |
| plan | org_plan enum | pro, agency, enterprise |
| status | subscription_status | |
| current_period_start | timestamp | |
| current_period_end | timestamp | |
| cancel_at_period_end | boolean | Default false |
| monthly_credits | integer | Credits per cycle |
| created_at | timestamp | |
| updated_at | timestamp | |

### purchases

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| stripe_payment_intent_id | text | Unique |
| stripe_customer_id | text | |
| amount | integer | Payment in cents |
| credits | integer | Credits purchased |
| currency | text | Default 'usd' |
| status | text | Default 'succeeded' |
| created_at | timestamp | |

## Agent Tables

### agent_runs

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| agent_type | text | e.g., 'ai-intelligence' |
| user_prompt | text | Original user prompt |
| response | text | Agent response (nullable, nulled after 30d) |
| recommendations | jsonb | Structured recommendations (nullable) |
| cited_data | jsonb | Data citations |
| credit_cost | integer | Credits consumed |
| status | agent_run_status | running, completed, failed |
| error | text | Nullable |
| duration_ms | integer | Execution time |
| created_at | timestamp | |

### scheduled_workflows

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| name | text | Human label |
| agent_type | text | Agent to run |
| prompt | text | User prompt |
| schedule_cron | text | Cron expression |
| delivery_channel | text | 'email' or 'slack' |
| delivery_target | text | Email address or webhook URL |
| is_active | boolean | Default true |
| last_run_at | timestamp | Nullable |
| next_run_at | timestamp | Nullable |
| created_at | timestamp | |

### workflow_run_history

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_id | uuid | FK → scheduled_workflows |
| project_id | uuid | FK → projects |
| ran_at | timestamp | Execution time |
| status | text | completed, failed |
| agent_response | text | Nullable |
| delivered | boolean | Whether delivery succeeded |
| error_message | text | Nullable |

## Monitoring Tables

### llm_traffic_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| source | text | AI platform (e.g., 'chatgpt', 'perplexity') |
| query | text | User query detected |
| landing_page | text | Page that received traffic |
| referrer | text | Full referrer URL |
| user_agent | text | |
| country | text | Nullable |
| created_at | timestamp | |

### llm_traffic_stats

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| date | date | Aggregation date |
| source | text | AI platform |
| sessions | integer | Session count |
| unique_queries | integer | Distinct queries |
| created_at | timestamp | |

### llm_audit_results

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| query | text | Test query |
| platform | text | AI platform tested |
| cited | boolean | Whether the site was cited |
| position | integer | Nullable, ranking position |
| snippet | text | Extracted citation snippet |
| competitor_citations | jsonb | Array of competitor citations |
| checked_at | timestamp | |
| cited_url | text | Nullable |
| created_at | timestamp | |

### tracked_prompts

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| prompt | text | Prompt to track |
| platform | text | Target platform |
| frequency | text | Check frequency |
| is_active | boolean | |
| last_checked_at | timestamp | Nullable |
| created_at | timestamp | |

### prompt_visibility_results

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| tracked_prompt_id | uuid | FK → tracked_prompts |
| project_id | uuid | FK → projects |
| platform | text | |
| cited | boolean | |
| position | integer | Nullable |
| snippet | text | |
| full_response | text | |
| competitor_citations | jsonb | |
| checked_at | timestamp | |
| created_at | timestamp | |

### keyword_decay_alerts

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| keyword_id | uuid | FK → keywords |
| keyword | text | Denormalized |
| previous_position | numeric | |
| current_position | numeric | |
| position_change | numeric | |
| previous_traffic | integer | |
| current_traffic | integer | |
| traffic_change_pct | numeric | |
| alert_type | text | 'position_drop', 'traffic_drop' |
| severity | text | 'low', 'medium', 'high', 'critical' |
| is_resolved | boolean | |
| created_at | timestamp | |
| resolved_at | timestamp | Nullable |

### notifications

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| project_id | uuid | FK → projects (nullable) |
| type | text | Notification type |
| title | text | |
| message | text | |
| data | jsonb | Additional context |
| is_read | boolean | Default false |
| created_at | timestamp | |

### dlq_failed_steps

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workflow_run_id | uuid | FK → workflow_runs |
| workflow_step_id | uuid | FK → workflow_steps |
| step_key | text | |
| error | text | Error message |
| attempt_count | integer | |
| job_data | jsonb | Full BullMQ job payload |
| resolved | boolean | Default false |
| created_at | timestamp | |

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
- `keywords`: compound on `(project_id, status)`, unique on `(project_id, keyword)`
- `credit_ledger`: compound on `(organization_id, created_at)`
- `gsc_connections`: unique on `(project_id)`
- `gsc_keyword_data`: compound on `(connection_id)`, `(project_id, date)`, `(query)`
- `subscriptions`: unique on `(stripe_subscription_id)`, indexed on `(organization_id)`, `(stripe_customer_id)`
- `purchases`: unique on `(stripe_payment_intent_id)`, indexed on `(organization_id)`
- `agent_runs`: indexed on `(project_id)`, `(organization_id)`, `(created_at)`
- `scheduled_workflows`: indexed on `(project_id)`, `(is_active)`
- `workflow_run_history`: indexed on `(workflow_id)`, `(project_id)`
- `llm_traffic_sessions`: indexed on `(project_id)`, `(source)`, `(created_at)`
- `llm_audit_results`: indexed on `(project_id)`, `(platform)`, `(checked_at)`
- `tracked_prompts`: indexed on `(project_id)`, `(is_active)`
- `invitations`: indexed on `(organization_id)`, `(token)` unique, `(email)`
- `access_grants`: compound unique on `(org_member_id, resource_type, resource_id)`
- `workspace_credit_limits`: unique on `(workspace_id)`
- All FK columns indexed

---

## User Management Tables

### invitations

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| organization_id | uuid | FK → organizations |
| email | text | Invitee email |
| role | enum | `admin` or `user` |
| token | text | `crypto.randomUUID()` — shared in invite link |
| status | invitation_status enum | `pending`, `accepted`, `revoked`, `expired` |
| expires_at | timestamp | 7 days from creation |
| accepted_at | timestamp | Nullable |
| clerk_invitation_id | text | Clerk's invitation ID (nullable) |
| invited_by_user_id | text | Clerk user ID of inviter |
| created_at | timestamp | |

### access_grants

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| org_member_id | uuid | FK → org_members |
| organization_id | uuid | FK → organizations |
| resource_type | access_grant_type enum | `org`, `workspace`, `project` |
| resource_id | uuid | FK to respective table depending on `resource_type` |
| created_at | timestamp | |

Unique constraint: `(org_member_id, resource_type, resource_id)`.  
Admins and owners bypass access_grants checks — only regular `user` role members are restricted.

### workspace_credit_limits

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces (unique) |
| organization_id | uuid | FK → organizations |
| monthly_limit | integer | Max credits per month for this workspace |
| current_month_usage | integer | Resets on 1st of each month via cron |
| last_reset_at | timestamp | When usage was last reset |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## Content Extended Tables

### forum_topics

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| source | text | e.g., 'reddit' |
| title | text | Thread title |
| url | text | Source URL |
| subreddit | text | Nullable |
| content | text | Scraped content |
| metadata | jsonb | Upvotes, comments, etc. |
| status | forum_topic_status enum | `discovered`, `analyzed`, `converted` |
| created_at | timestamp | |

### forum_opportunities

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| forum_topic_id | uuid | FK → forum_topics |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| opportunity_type | text | e.g., 'content_gap', 'pain_point' |
| title | text | |
| description | text | |
| priority | forum_opportunity_priority enum | `low`, `medium`, `high` |
| metadata | jsonb | AI-extracted details |
| created_at | timestamp | |

### project_assets

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| project_id | uuid | FK → projects |
| organization_id | uuid | FK → organizations |
| name | text | File name |
| file_path | text | Storage path |
| mime_type | text | |
| size_bytes | integer | |
| uploaded_by | text | Clerk user ID |
| created_at | timestamp | |

---

## New Enums (added June 2026)

| Enum | Values |
|------|--------|
| `invitation_status` | `pending`, `accepted`, `revoked`, `expired` |
| `access_grant_type` | `org`, `workspace`, `project` |
| `forum_topic_status` | `discovered`, `analyzed`, `converted` |
| `forum_opportunity_priority` | `low`, `medium`, `high` |

