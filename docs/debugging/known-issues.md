# Known Issues

## Resolved Issues

### [Agent Non-Deterministic JSON Shapes — All 18 Steps]
- **Status**: Resolved
- **Discovered**: 2026-05-14
- **Affects**: All workflow step renderers (Steps 1–18)
- **Description**: Agent prompts referenced "Return as structured JSON matching the output schema" or listed only field names. Because `agent.md` body content is NOT sent to the model at runtime (only the `.prompt.md` file is), the model had no schema to follow and hallucinated a different JSON structure on every run. Observed 4 distinct shapes for method02-seed-expansion alone across 4 runs. Downstream renderers would crash or show [object Object] / 0% scores.
- **Root Cause**: PromptService.loadPrompt() reads only the `.prompt.md` file. The agent definition body (which contains the output schema) is loaded by AgentRegistry for validation only, never sent to the model.
- **Resolution**: Added `## CRITICAL: Output Schema Enforcement` blocks with explicit "Do NOT..." rules and inline JSON templates to all 18 `.prompt.md` files. Added multi-shape normalizers to all affected renderers. Bumped max_iterations on 13 agents that were too low to complete their tool-call chains.

### [Agent max_iterations Too Low — Steps 1, 2, 3, 4, 5, 6, 7, 8, 12, 13, 14, 15, 17]
- **Status**: Resolved
- **Discovered**: 2026-05-14
- **Affects**: Multiple workflow steps
- **Description**: Agent definitions had max_iterations values (3–6) too low for their required tool-call counts. Steps like site-audit (8+ tool calls) or search-demand (batching 50–150 keywords across 4 APIs) would hit the iteration cap and return partial or empty output with `finishReason: 'max_iterations'`.
- **Resolution**: Bumped all affected agents: business-profile 3→8, site-audit 5→12, serp-niche-map 4→10, ai-intelligence 4→10, competitor-buckets 3→8, search-demand 4→12, competitor-metrics 4→10, method03-content-gap-import 3→8, consolidated-keywords 4→10, verdict-strategy 3→8, topical-map 3→8, content-article 3→8, seed-keywords 6→10.

### [method02-seed-expansion Renderer — 4 Distinct Agent Output Shapes]
- **Status**: Resolved
- **Discovered**: 2026-05-13
- **Affects**: Step 11 renderer
- **Description**: Agent returned v1 (object), v2 (array + string relatedKeywords), v3 (array + object relatedKeywords), v4 ({topicName: ExpandedKeyword[]}). Renderer only handled v2. v3 caused [object Object], v4 returned no results.
- **Resolution**: Normalizer handles all 4 shapes. OpportunityScore computed from formula at normalization time. Prompt rewritten with inline schema.


- **Status**: Resolved
- **Discovered**: 2026-05-07
- **Affects**: Keyword workflow generation and any other BullMQ enqueue path in local Windows development
- **Description**: On this Windows host, BullMQ job inserts succeeded but `queue.add(...)` could hang indefinitely when Redis was configured as `localhost`, leaving the workflow UI stuck on `Starting...` and the DB job row stranded in `PENDING`.
- **Workaround**: Use `127.0.0.1` instead of `localhost` for the Redis host in local Windows development.
- **Resolution**: `server/src/app.module.ts` now normalizes the BullMQ Redis host to `127.0.0.1` on Windows when no explicit non-local host is configured.

### [Backend Misses Repo Env When Launched From Root]
- **Status**: Resolved
- **Discovered**: 2026-05-07
- **Affects**: Keyword workflow SERP mapping, competitor discovery, and any backend integration that depends on API keys from the repo root `.env`
- **Description**: The backend could be launched either from `server/` as `node .\dist\main.js` or from the repo root as `node .\server\dist\main.js`. With `ConfigModule.forRoot({ envFilePath: '../.env' })`, the root-launched process resolved `../.env` relative to the wrong working directory and skipped the real repo `.env`, so live workflow generation behaved as if Serper/Ahrefs keys were missing even when the file contained them.
- **Workaround**: Start the backend from `server/` so `../.env` happens to resolve to the repo root.
- **Resolution**: `server/src/app.module.ts` now resolves the repo root `.env` from `__dirname` and keeps cwd-based fallbacks, so both launch styles load the same env file.

## Tracking Template

## Template

```
### [Issue Title]
- **Status**: Open / Investigating / Resolved
- **Discovered**: YYYY-MM-DD
- **Affects**: [feature / component]
- **Description**: ...
- **Workaround**: ...
- **Resolution**: ...
```
