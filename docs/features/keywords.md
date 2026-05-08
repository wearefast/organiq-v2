# Keywords Feature

## Overview

The keyword feature is being refactored into an English-first, strategist-grade workflow in the authenticated dashboard. The public audit remains a lightweight acquisition lane, but the dashboard workflow becomes the source of truth for reviewed business profile, approved seed keywords, competitor buckets, Phase 1 baseline, method outputs, keyword consolidation, and topical maps.

## Product Boundary

| Lane | Purpose | Source of Truth | Current State |
|------|---------|-----------------|---------------|
| Public audit | Fast automated acquisition and diagnostic output | `audits.rawData` | Implemented and should remain lightweight |
| Keyword workspace | Human-in-the-loop keyword research and topical planning | Keyword workflow entities and approved artifacts | Planned implementation target |

The audit pipeline can continue to reuse Ahrefs, SERP, and GPT integrations, but it should not own strategist approvals, final keyword ledgers, or publishable topical maps.

## English-First Workflow

The dashboard workflow should execute these checkpoints in order:

| Step | Output | Review Requirement |
|------|--------|--------------------|
| Business profile | Brand, market, offer, geography, suggested seeds | Internal approval required |
| Seed keywords | Approved seed list | Internal approval required |
| SERP niche map | Core topics, sub-topics, page-type observations | Internal approval required |
| Competitor buckets | Direct and organic competitor lists | Internal approval required |
| Competitor metrics | Comparable metrics sheet and top pages | Internal approval required |
| Phase 1 baseline | Existing winning URLs, keywords, dedupe list, core topics | Internal approval required |
| Method 01 | Competitor top pages + keyword candidates | Internal approval required |
| Method 02 | Matching terms + related terms grouped by parent topic | Internal approval required |
| Method 03 | Manual Ahrefs Content Gap import and normalization | Internal approval required |
| Consolidation | Final keyword ledger with dedupe and provenance | Internal approval required |
| Topical map | Approved pillar/cluster structure | Internal approval required |

## Method Rules

| Method | Rule | Notes |
|--------|------|-------|
| Phase 1 | Must run before ideation | Establishes existing coverage and dedupe list |
| Method 01 | Only approved direct competitors | Pull top pages and organic keywords |
| Method 02 | Driven by approved seed keywords | Group by parent topic |
| Method 03 | Manual Ahrefs UI export | Accuracy-first by design; do not replace with the audit approximation |
| Consolidation | Deduplicate against Phase 1 and across methods | Preserve full source attribution |

## Provenance Requirements

Every keyword retained in the strategist workflow must preserve:

| Field | Purpose |
|-------|---------|
| `language` | English in the first implementation |
| `country` | Market-specific research context |
| `sourceMethods[]` | Which method introduced the keyword |
| `sourceArtifactIds[]` | Which reviewed artifacts support the keyword |
| `dedupeStatus` | Whether the keyword was kept, removed as duplicate, or rejected |
| `approvalStatus` | Whether the keyword is a candidate or approved |
| `existingCoverageUrl` | Existing page that already covers the topic, if any |

## Relationship To Current Audit Logic

The current audit pipeline already implements a local Step 07 content-gap approximation:

1. Persist the merged Ahrefs keyword pool to `rawData.keywordPool`.
2. Treat the client's top-ranked keywords as the covered set.
3. Rank direct and organic competitors by usable footprint and overlap signals.
4. Probe Ahrefs organic keywords for each candidate.
5. Skip unusable competitors and backfill from the next ranked candidate.
6. Create primary gaps from multi-competitor overlap.
7. Create `emergingOpportunities` from single-competitor overlap.

That logic is useful for automated audits, but it is not the strategist workflow's Method 03. The strategist workflow should use manual Ahrefs Content Gap import as the authoritative high-accuracy input.

## Implementation Priorities

| Priority | Outcome |
|----------|---------|
| P1 | Add workflow state, artifacts, approvals, and provenance to the keyword product |
| P2 | Align frontend and backend keyword routes around workflow runs |
| P3 | Make Phase 1 and manual Content Gap import first-class workflow steps |
| P4 | Generate topical maps only from approved artifacts |

## Implemented Foundation

The first workflow foundation slice is now implemented in the backend:

| Area | Implemented |
|------|-------------|
| Schema | `keyword_workflow_runs`, `keyword_workflow_artifacts`, `keyword_workflow_approvals` |
| Keyword provenance fields | `workflowRunId`, `language`, `country`, `sourceMethods`, `sourceArtifactIds`, `approvalStatus`, `dedupeStatus` |
| Topical/content linkage | `workflowRunId` added to topical maps and content pieces |
| API | `POST /keywords/projects/:id/workflows`, `GET /keywords/projects/:id/workflows/:workflowId`, `POST /keywords/projects/:id/workflows/:workflowId/artifacts`, `GET /keywords/projects/:id/workflows/:workflowId/checkpoints/:stepKey`, checkpoint decision endpoints |

Current scope of the implemented API foundation:

- workflow creation is English-only in the first release (`language = en`)
- workflow retrieval returns the workflow run plus stored artifacts and approvals
- manual artifact creation and checkpoint review decisions are now persisted in the backend
- existing project CRUD and discovery routes remain unchanged
- worker-driven artifact generation and next-step orchestration are still pending

## Frontend Contract Repair

The first frontend repair slice is now implemented:

| Area | Implemented |
|------|-------------|
| Service routes | Frontend keyword service now targets `/keywords/projects/...` and workflow/checkpoint endpoints |
| Project model | Frontend project contract now matches backend `websiteUrl`, `seedKeywords`, and `createdAt` fields |
| Dashboard page | Keyword dashboard now renders real project data instead of a static placeholder |

Still pending in the frontend:

- workflow run creation UI
- checkpoint review UI
- artifact editing UI
- topical map review surfaces

## Workflow Shell UI

The next Epic C slice is now implemented in the dashboard:

| Area | Implemented |
|------|-------------|
| Workflow creation | Per-project English workflow creation form inside a dedicated project workspace |
| Workflow route | `dashboard/keywords/[projectId]/workflows/[workflowId]` shell |
| Artifact authoring | Step-aware artifact submission form with a generated Step 1 business-profile draft path for current internal testing |
| Checkpoint review | Approve / request revision / reject controls for the latest artifact per step |

Current limitation of this shell:

- project selection now lives on the shared index, but workflow history is only available after entering a project workspace
- Steps 01 and 02 now hand off draft business context and generated seed keywords, but broader worker-driven generation is still pending for the remaining research steps
- checkpoint review is step-latest only and not yet a full revision history UI

## Recent Epic C Progress

The next two Epic C follow-up steps are now implemented:

| Area | Implemented |
|------|-------------|
| Workflow re-entry | Existing workflow runs are listed inside each project workspace and link back into the workflow shell |
| Step-aware authoring | Artifact submission now uses step-specific prompts and stores structured findings, recommendations, evidence, and open questions |

Remaining near-term gaps:

- no dedicated cross-run comparison page beyond the per-project workspace
- no worker-driven artifact generation yet
- no compare or diff UI for prior checkpoint records

## Technical Debt

The following items are intentionally deferred and should be scheduled later rather than folded into the current workflow shell slice:

| Debt Item | Why Deferred | Future Direction |
|-----------|--------------|------------------|
| Backend CORS allowlist for active frontend dev origins | The keyword walkthrough required isolated local ports, and the backend currently only allows a narrow local-origin set | Make local dev origins configurable so browser walkthroughs do not depend on special ports |
| Competitor edit/delete controls | The next workflow priority is Method 01 execution from approved direct competitors, so competitor list refinement is deferred | Add edit and delete controls for saved competitors once the Method 01 flow is stable |

## Latest Workflow Slice

The next planned workflow step is now implemented:

| Area | Implemented |
|------|-------------|
| Checkpoint history | Full checkpoint history is now rendered per step in the workflow shell, including prior saved records and their latest decisions |
| Active-step checkpoint mutation | Backend saves and worker regenerations now rewrite the current step artifact in place instead of appending a new active-step version, and the API rejects edit/generate attempts for approved or non-current steps |
| Approval-triggered auto-generation | Approving a step now automatically queues the next step when that step already has a workflow generator mapping, so the workflow advances without a separate manual trigger for auto steps |
| Inline generate actions | Auto-generated steps now place the generate button beside the active workspace title so the trigger stays in the header instead of occupying its own block below the intro copy |
| Business-profile header generation | The Business Profile workspace now keeps the draft-generation trigger beside the step header and keeps optional supporting content collapsed by default in a header disclosure instead of a standalone card inside the form |
| Business-profile seed keyword preservation | Step 1 now preserves structured seed keywords when the business profile is approved and backfills them from legacy “Suggested seed keywords” findings so the Step 1 output and Step 2 handoff both keep the generated seed list |
| Seed-keywords header generation | The Seed Keywords workspace now shows a header-level Generate button that creates the Step 2 draft from the latest Business Profile seed candidates and stays disabled until Step 1 provides a source set |
| Read-only non-current steps | The workflow shell now distinguishes the selected step from the actual editable checkpoint, hides edit/review actions for non-current steps, removes standalone read-only cards, and shows the locked state with a header lock icon instead |
| Locked-step payload visibility | Locked and approved steps now render their saved checkpoint payload inline in the review panel instead of hiding the approved content behind a collapsed disclosure |
| Locked-step decision cleanup | Locked-step review panels no longer repeat the decision in a separate card because the current decision already appears in the status badge row |
| Locked-step status placement | Locked-step workspaces now place the current status pill directly under the lock icon in the header and remove duplicate status pills from the read-only card and checkpoint panel |
| Locked-step review shell cleanup | Locked-step workspaces no longer wrap the latest summary and approved details in a separate checkpoint-status card shell; the saved content now sits directly in the workspace body |
| Legacy checkpoint copy normalization | Previously saved summary and payload text now render with checkpoint language in the workflow shell, and version-only payload fields are hidden from review surfaces so older data reads consistently during the no-version rollout |
| Workflow step wizard | The workflow shell now renders a left-side wizard sub-panel with a collapsed numbered step rail, icon-based checkpoint states, custom hover/focus tooltips anchored beneath each step title, and compact single-row step metadata across the full keyword workflow |
| Neutral upcoming rail styling | The next scheduled step in the workflow rail now uses the same neutral marker, badge, and icon styling as the rest of the upcoming steps instead of a separate orange accent |
| Collapsible workflow rail | The left workflow step rail now uses the full rail width, scrolls within the viewport, and keeps the collapse control inside the rail card so long runs stay usable during editing and review |
| Active workspace focus | The main workflow pane now renders only the active step workspace and keeps checkpoint approval in that same view, instead of stacking non-active step workspaces, secondary review cards, and revision history below it |
| Output-first generic workspace | Generic artifact-form steps now render the latest checkpoint output and approval actions before a collapsed Input panel, so strategists land on the saved result first |
| Output-first competitor workspaces | Competitor buckets and competitor metrics now lead with the saved checkpoint output and keep competitor entry, saved rosters, and metrics authoring inside a collapsed Input panel |
| Output-first method and handoff workspaces | Method 01, Method 02, content brief, and content article now open on the latest checkpoint output first and move source selection or generation controls behind the same collapsed Input shell |
| Overflow-safe payload review | Human-readable checkpoint payload cards now allow nested grid cells to shrink and wrap long URL/list values, so competitor discovery output no longer overlaps neighboring review content |
| Above-the-fold review actions | Data-heavy steps like Competitor Buckets now keep approval controls above the long checkpoint payload so Approve / Request revision / Reject remain visible without scrolling through the full result first |
| Specialized competitor approval flow | Competitor Buckets and Competitor Metrics no longer hide approval inside the collapsed artifact form; they now use the visible review card actions in the output-first shell |
| Approval-implies-save flow | The step-aware artifact form now treats approval as the persistence boundary for editable workflow steps, so approving from the form saves the current values and advances the workflow without a separate save-checkpoint action |
| Human-readable artifact review | Workflow artifact payloads now render as labeled sections and lists instead of raw JSON blocks inside the active checkpoint, secondary review cards, and revision history |
| Step advancement on approval | Approving a checkpoint now advances the workflow shell to the next step instead of leaving the just-approved step selected as the active workspace |
| Inline active-step approval | The current step workspace now includes the latest saved artifact summary, payload preview, and approval controls directly below authoring so approval is the next action instead of a bottom-of-page jump |
| Business-profile draft generation | Step 01 can now fetch the project website, call OpenAI, save a draft business-profile artifact, and repopulate the editable form before review |
| Seed-keyword handoff | Step 02 now loads the latest approved seed-carrying business-profile artifact so reviewers confirm or edit the actual Step 1 output even when newer Step 1 revisions no longer carry the original generated seed list |
| SERP niche handoff | Step 03 now loads the latest approved seed-keywords artifact so strategists start SERP mapping from the confirmed Step 2 keyword set instead of a blank form |
| Manual Content Gap import | Method 03 now creates a dedicated `content_gap_imports` backend record through a workflow API, then links the artifact payload back to that import |
| Phase 1 baseline capture | Phase 1 now has a dedicated workflow capture surface for existing winning URLs, core topics, existing keywords, and priority verticals |
| Competitor candidates | Workflow runs now persist structured competitor records via `project_competitors` instead of relying only on checkpoint notes |
| Competitor metrics foundation | Workflow competitors can now store structured metrics and top pages through `project_competitor_metrics`, and workflow reads return those metrics nested under each competitor |
| Competitor workflow UI | The workflow shell now lets strategists add competitor records and capture comparable metrics directly from the dashboard |
| Method 01 source set | The workflow shell now creates Method 01 artifacts from approved direct competitors selected in the competitor workspace and auto-ingests their stored top pages |
| Method 02 source set | The workflow shell now creates Method 02 artifacts from stored project keyword rows when they exist and falls back to the project seed-keyword set otherwise |
| Consolidation generator | The workflow shell can now create a first-pass consolidated keyword artifact from the latest approved Phase 1, Method 01, Method 02, and Method 03 sources |
| Topical map generator | The workflow shell can now promote the latest approved consolidated ledger into pillar/grouped cluster candidates and a first-pass content-brief queue |
| Research persistence | Approving `consolidated-keywords` now promotes a workflow-scoped final keyword ledger into `keywords`, and approving `topical-map` now promotes the final structure into `topical_maps` |
| Final review/export UI | The workflow shell now renders persisted final research outputs and provides workflow-scoped CSV/JSON exports for the promoted keyword ledger and topical map |
| Workflow review aggregation | Workflow-level status now reflects the latest status across all checkpoint steps instead of mirroring only the most recently reviewed checkpoint |
| New project entry point | The keyword dashboard now exposes a dedicated `dashboard/keywords/new` route plus populated-state and empty-state CTAs so brand-new projects can be created without API seeding |
| Project workspace | The shared keyword dashboard now acts as a project picker, and `dashboard/keywords/[projectId]` owns workflow creation plus run history for a single project |

Updated near-term gaps:

- no dedicated cross-run comparison page beyond the per-project workspace
- the new output-first Input/Output shell now covers generic, competitor, Method 01/02, and content handoff steps; Phase 1, Method 03, consolidation, and topical-map generation surfaces still need the same treatment
- checkpoint history still reflects legacy stored records even though the active-step data model now persists and reads checkpoint rows without a version column
- Method 01 now auto-ingests stored competitor top pages, but keyword candidate extraction and ranking are still strategist-reviewed
- Method 02 can auto-build from stored project keyword rows, but it still falls back to the project seed-keyword set until a dedicated approved-seed checkpoint ledger is promoted into the source selector
- Consolidated-keyword promotion currently infers `intent` and `funnel` when the approved artifact payload does not yet store explicit classification fields
- no worker-driven artifact generation yet

## Server Files

- `server/src/features/keywords/keywords.module.ts`
- `server/src/features/keywords/keywords.controller.ts`
- `server/src/features/keywords/keywords.service.ts`
- `server/src/features/audit/audit.processor.ts`

## Frontend Files

- `frontend/src/app/dashboard/keywords/page.tsx`
- `frontend/src/app/dashboard/keywords/new/page.tsx`
- `frontend/src/app/dashboard/keywords/[projectId]/page.tsx`
- `frontend/src/app/dashboard/keywords/[projectId]/workflows/[workflowId]/page.tsx`
- `frontend/src/features/keywords/services/keywords.service.ts`
