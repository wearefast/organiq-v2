# Content Feature

## Overview

The content feature should consume approved strategist-workflow outputs, not flat keyword rows alone. In the English-first rollout, briefs and articles are generated only after the keyword workflow has approved the topical map and the target keyword context.

## Workflow Boundary

| Stage | Owner | Requirement |
|-------|-------|-------------|
| Keyword discovery and review | Keyword workflow | Must be complete and approved first |
| Topical map approval | Keyword workflow | Required before brief generation |
| Brief generation | Content workflow | Uses approved keyword and topical-map context |
| Brief review | Internal strategist/editor | Required before article generation |
| Article generation | Content workflow | Uses approved brief inputs |
| Article review | Internal strategist/editor | Required before publish-ready status |

## English-First Workflow

1. Select an approved keyword from an approved workflow run.
2. Load topical context: pillar, cluster, intent, funnel, mapped URL, existing coverage, and provenance.
3. Generate brief through `content-queue` using structured workflow inputs.
4. Review and approve or request revision on the brief.
5. Generate article from the approved brief.
6. Review and approve or request revision on the article.
7. Mark content as publish-ready or published.

## Required Inputs For Brief Generation

| Input | Purpose |
|-------|---------|
| Keyword | Primary target query |
| Pillar / cluster context | Maintain topical-map consistency |
| Intent and funnel | Shape structure and CTA depth |
| Market / country | Keep SERP assumptions market-specific |
| Existing coverage | Avoid overlap with already-performing URLs |
| Competitor / SERP notes | Preserve strategist research context |
| Internal links | Support final publishing plan |
| Editorial notes | Capture strategist guidance before drafting |

## Review States

| Status | Description |
|--------|-------------|
| `brief` | Brief generated, awaiting review |
| `draft` | Article generated, in draft |
| `review` | Under human review |
| `approved` | Approved, ready to publish |
| `published` | Published to CMS |

The first implementation should keep these statuses, but approvals should be tied to workflow artifacts and review notes rather than only a flat status transition.

## Current Gap

The current content module is a structural shell:

- it can queue brief and article generation
- it exposes content endpoints
- it does not yet operate on workflow artifacts, checkpoint approvals, or topical-map context
- `OpenAIService.generateContentBrief()` and `OpenAIService.generateArticle()` still need real structured-generation implementations

## Latest Workflow Slice

| Area | Implemented |
|------|-------------|
| Workflow brief handoff | The keyword workflow shell can now promote an approved topical-map queue entry into a `content-brief` artifact with pillar, target keyword, suggested URL, outline, and editorial notes |
| Workflow article handoff | The keyword workflow shell can now promote an approved `content-brief` artifact into a `content-article` artifact with selected title, section plan, draft checklist, and carried-forward research context |
| Approval gating | Content brief generation stays blocked until a topical-map artifact is approved, and article generation stays blocked until a `content-brief` artifact is approved |
| Content persistence | Approving `content-brief` now upserts a workflow-linked `content_pieces` row with the approved brief payload, and approving `content-article` enriches that same row with the approved article input metadata and draft status |
| Workflow content review | The keyword workflow shell now renders persisted `content_pieces` rows so strategists can confirm that approved brief/article checkpoints have materialized into the content pipeline |
| Dashboard content preview | The dashboard content table now opens an in-place modal that loads the persisted `GET /content/:id` payload, renders stored brief/article inputs plus any saved article body, and falls back only when no persisted content exists |

Updated near-term gaps:

- the content queue is not yet consuming approved workflow artifacts directly
- approved article promotion currently persists draft input metadata and selected title into `content_pieces`, but it does not yet generate or store publishable body copy
- `OpenAIService.generateContentBrief()` and `OpenAIService.generateArticle()` still need real structured-generation implementations

## Dashboard Preview Data

| Source | Usage |
|--------|-------|
| `GET /content` | Hydrates the dashboard table with the stored title, status, keyword/pillar context, and created date |
| `GET /content/:id` | Hydrates the modal with persisted brief payload fields, article input metadata, internal-link targets, and any stored draft body |
| Modal fallback | Displays mock preview content only when a row has no persisted detail payload to fetch |

## Implementation Priorities

| Priority | Outcome |
|----------|---------|
| P1 | Make content generation workflow-aware |
| P2 | Require approved topical-map inputs before brief generation |
| P3 | Add brief/article review notes and revision flow |
| P4 | Keep article generation blocked until brief approval |

## Server Files

- `server/src/features/content/content.module.ts`
- `server/src/features/content/content.controller.ts`
- `server/src/features/content/content.service.ts`
- `server/src/features/integrations/services/openai.service.ts`

## Frontend Files

- `frontend/src/features/content/services/content.service.ts`
- `frontend/src/app/dashboard/keywords/[projectId]/workflows/[workflowId]/page.tsx`
