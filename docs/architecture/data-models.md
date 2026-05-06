# Data Models

## ORM

Drizzle ORM with PostgreSQL. Schema at `server/src/db/schema.ts`.

## Product Boundary

Pulse currently has two distinct product lanes:

| Lane | Data Owner | Purpose |
|------|------------|---------|
| Public audit | `audits` and related lead data | Fast acquisition and automated diagnostics |
| Keyword workspace | Keyword workflow entities, keywords, topical maps, and content | Human-in-the-loop strategist workflow |

The audit lane can continue to reuse the same integrations, but it should not become the source of truth for approved keyword research artifacts.

## Tables

### Current Tables

| Table | Description |
|-------|-------------|
| `users` | Clerk-synced user accounts |
| `leads` | Audit submission leads |
| `audits` | Website audit records + scores |
| `keyword_projects` | Keyword research projects |
| `topical_maps` | Pillar/cluster topic maps |
| `keywords` | Individual keyword records |
| `content_pieces` | Generated content (briefs + articles) |

### Required Workflow Tables

These are the target entities for the English-first strategist workflow. They document the intended schema direction for the next implementation epic.

| Table | Description |
|-------|-------------|
| `keyword_workflow_runs` | One guided workflow run per project/language/market |
| `keyword_workflow_artifacts` | Immutable, versioned outputs for each checkpoint |
| `keyword_workflow_approvals` | Approval, revision, and rejection decisions per artifact |
| `project_competitors` | Reviewed competitor candidates and approved buckets |
| `project_competitor_metrics` | Comparable metrics captured per approved competitor |
| `content_gap_imports` | Manual Ahrefs Content Gap uploads and parsed rows |

## Enums

| Enum | Values |
|------|--------|
| `audit_status` | pending, processing, complete, failed |
| `lead_status` | new, contacted, qualified, converted, lost |
| `keyword_intent` | transactional, commercial, informational, navigational |
| `funnel_stage` | tofu, mofu, bofu |
| `keyword_status` | discovered, approved, brief_ready, written, published |
| `content_status` | brief, draft, review, approved, published |

### Planned Workflow Enums

| Enum | Values |
|------|--------|
| `workflow_status` | draft, running, awaiting_approval, revision_requested, approved, completed, failed, archived |
| `workflow_step_key` | business-profile, seed-keywords, serp-niche-map, competitor-buckets, competitor-metrics, phase1-baseline, method01-competitor-pages, method02-seed-expansion, method03-content-gap-import, consolidated-keywords, topical-map, content-brief, content-article |
| `workflow_decision` | approved, revision_requested, rejected |
| `competitor_bucket` | direct, organic, unclassified |
| `competitor_status` | candidate, approved, rejected |
| `dedupe_status` | kept, duplicate_existing, duplicate_cross_method, irrelevant, rejected |

## Entity Relationships

```
users ──1:N──> audits
users ──1:N──> keyword_projects
leads ──1:1──> audits
keyword_projects ──1:N──> keyword_workflow_runs
keyword_workflow_runs ──1:N──> keyword_workflow_artifacts
keyword_workflow_artifacts ──1:N──> keyword_workflow_approvals
keyword_projects ──1:N──> project_competitors
project_competitors ──1:1──> project_competitor_metrics
keyword_workflow_runs ──1:N──> content_gap_imports
keyword_workflow_runs ──1:N──> keywords
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

### Required Keyword Workflow Fields

The final keyword ledger should retain strategist-review context and provenance:

| Field | Purpose |
|-------|---------|
| `workflowRunId` | Tie the keyword to a specific guided workflow run |
| `language` | English in the first rollout |
| `country` | Market-specific research context |
| `sourceMethods` | Preserve Method 01 / Method 02 / Method 03 / Phase 1 lineage |
| `sourceArtifactIds` | Reference the reviewed artifacts that support the keyword |
| `approvalStatus` | Candidate vs approved state |
| `dedupeStatus` | Track whether the keyword was retained or removed |
| `existingCoverageUrl` | Link to any existing page that already covers the topic |
| `parentTopic` | Parent topic used for topical-map grouping |
| `contentType` | Recommended destination page/content type |

## Workflow Artifact Model

Each major strategist checkpoint should create an immutable artifact version rather than mutating a single project record in place.

| Artifact | Payload Summary |
|----------|-----------------|
| Business profile | Brand, audience, offer, geography, seed suggestions |
| Seed keywords | Candidate list, approved list, notes |
| SERP niche map | Core topics, sub-topics, page-type observations |
| Competitor buckets | Candidate, approved, and rejected competitors |
| Competitor metrics | DR, backlinks, traffic, top pages |
| Phase 1 baseline | Existing winning pages, existing keywords, dedupe list |
| Method 01 | Competitor-page keyword candidates |
| Method 02 | Matching terms, related terms, parent topics |
| Method 03 | Manual Content Gap import and normalized rows |
| Consolidated keywords | Final ledger before topical-map generation |
| Topical map | Pillar/cluster structure and target URL mapping |
| Content brief/article | Generated content plus review notes |

## Content Handoff

Content generation should no longer start from a flat approved keyword alone. The target model is:

1. Approved workflow run
2. Approved consolidated keyword
3. Approved topical-map node
4. Brief generation
5. Brief approval
6. Article generation
7. Article approval

This keeps content output tied to reviewed strategist decisions rather than unstructured keyword rows.

## Commands

```bash
# Push schema to database (dev)
npm run db:push

# Seed database
npm run db:seed

# Open Drizzle Studio
cd server && npx drizzle-kit studio
```
