# Tool Audit — Pulse OS

> **Last audited:** June 4, 2026 (Release 16 — CTO Deep Audit Round 3)
> **Auditor:** CTO / Principal Engineer
> **Tool registry:** `server/src/agents/tool.registry.ts`

---

## R16 Tool Findings

| Finding | Severity | File | Status |
|---------|---------|------|--------|
| `generate_image` returns raw base64 PNG — agent stores in `return_output`, which lands in `step_artifacts.data` JSONB (15-30 MB per run) | 🔴 Critical | `openai.service.ts:generateImage`, `workflow.processor.ts:433` | ❌ **Open (R16-C1)** — base64 must be stripped before persisting to artifacts/context |
| `content-images` tool call goes against `gpt-image-1` with no response timeout beyond `AbortSignal.timeout(120_000)` — image generation can be slow; 5 sequential image calls can take 5-10 minutes, approaching the 30-min workflow step AbortController | 🟡 Medium | `openai.service.ts:generateImage` | ❌ **Open** |

---

## R13 Tool Findings

| Finding | Severity | File | Description |
|---------|---------|------|-------------|
| `search-demand.agent.md` lists tools but uses `pipeline-only` | 🟡 Medium | `definitions/search-demand.agent.md` | `tools: [ahrefs_keyword_volume, ahrefs_keyword_difficulty, dataforseo_keyword_volume, dataforseo_keyword_difficulty]` in frontmatter, but `execution_type: pipeline-only` means NO LLM is invoked — tools are never called by Claude. The tools list is dead metadata. |
| `content-brief` pipeline never fires Serper/Firecrawl | 🔴 Critical | `content-brief.pipeline.ts:32` | Target keyword lookup reads from `context['verdict-strategy'].contentPlan[0].targetKeyword` — field doesn't exist in verdict-strategy output. `targetKeyword` always empty → both Serper and Firecrawl calls are skipped. |
| `firecrawl_scrape` / `serper_search` listed as available via `business-profile` | 🟢 OK | pipeline only | business-profile now seeds from project data; actual pipeline still calls these services directly (not via agent tool calls) — correct. |
| `dataforseo_serp` registered but not confirmed in any active pipeline | 🟡 Low | tool registry | Cannot trace to any `*.pipeline.ts`. Safe to remove or mark reserved. |

---

## Tool Availability by Execution Type

| Execution Type | Tools Available | Notes |
|---------------|-----------------|-------|
| `pipeline-only` | None | No LLM invocation |
| `pipeline-then-agent` | **None** (`allowedTools: []`) | Pipeline pre-fetches; agent synthesises from `<pipeline_data>` |
| `agent-only` | **None** (`allowedTools: []`) | Pure synthesis over `<workflow_context>` |
| `agent-with-tools` | Declared in `.agent.md` `tools:` frontmatter | Agent actively calls tools during execution loop |

> **Critical:** `allowedTools: []` is set for ALL `pipeline-then-agent` and `agent-only` steps. Prompts for these steps must NOT instruct tool calls. Any such instruction is a prompt defect — see `audit/prompt-audit.md`.

---

## Tool Inventory

### Ahrefs Tools (Site Explorer)

| Tool Name | Method | Credit Cost | Steps That May Use |
|-----------|--------|-------------|-------------------|
| `ahrefs_domain_rating` | `getDomainRating(domain)` | ~1 unit | competitor-metrics pipeline |
| `ahrefs_backlinks` | `getBacklinks(domain)` | ~1 unit | competitor-metrics pipeline |
| `ahrefs_organic_keywords` | `getOrganicKeywords(domain, country, limit)` | ~1 unit | competitor-metrics pipeline, phase1-baseline (fallback) |
| `ahrefs_organic_pages` | `getOrganicPages(domain, country, limit)` | ~1 unit | method01-competitor-pages pipeline, phase1-baseline pipeline |
| `ahrefs_serp_overview` | `getSerpOverview(keyword, country)` | ~1 SERP credit | serp-niche-map pipeline |
| `ahrefs_referring_domains` | `getReferringDomains(domain)` | ~1 unit | competitor-metrics pipeline |

### Ahrefs Tools (Keywords Explorer)

| Tool Name | Method | Credit Cost | Steps That May Use |
|-----------|--------|-------------|-------------------|
| `ahrefs_related_keywords` | `getRelatedKeywords(keyword, country)` | ~1 unit | seed-keywords pipeline |
| `ahrefs_keyword_suggestions` | `getKeywordSuggestions(keyword, country)` | ~1 unit | seed-keywords pipeline |
| `ahrefs_keyword_difficulty` | `getKeywordDifficulty(keywords[])` | ~1 unit/kw | ⚠️ Registered but currently unused in active pipelines |
| `ahrefs_content_gap` | `getContentGap(target, competitors[])` | ~1 unit | method03 (if implemented) |

### DataForSEO Tools

| Tool Name | Module | Credit Cost | Steps That May Use |
|-----------|--------|-------------|-------------------|
| `dataforseo_keyword_volume` | Volume batch | ~0.05/kw | search-demand pipeline |
| `dataforseo_keyword_difficulty` | KD batch | ~0.05/kw | search-demand pipeline |
| `dataforseo_serp` | SERP results | ~0.1/query | ⚠️ Registered but verify active usage |

### Web Tools

| Tool Name | Service | Credit Cost | Steps That May Use |
|-----------|---------|-------------|-------------------|
| `firecrawl_scrape` | Firecrawl | ~$0.001/page | business-profile pipeline, content-brief pipeline |
| `serper_search` | Serper.dev | ~$0.001/query | business-profile pipeline, content-brief pipeline |

### PageSpeed / CrUX Tools

| Tool Name | Service | Credit Cost | Steps That May Use |
|-----------|---------|-------------|-------------------|
| `pagespeed_analysis` | Google PageSpeed | Free | site-audit pipeline |
| `crux_data` | Google CrUX | Free | site-audit pipeline |

### GSC Tools

| Tool Name | Service | Credit Cost | Steps That May Use |
|-----------|---------|-------------|-------------------|
| `gsc_search_analytics` | Google Search Console | Free | seed-keywords pipeline (if configured) |

---

## Agent Tool Access Matrix (Post-R13)

| Step | Execution Type | tools: frontmatter | Effective Tools |
|------|---------------|--------------------|-----------------|
| seed-keywords | pipeline-then-agent | — | **None** (`allowedTools: []`) |
| site-audit | pipeline-then-agent | — | **None** |
| ai-intelligence | agent-with-tools | declared | Claude tools (research tools) |
| serp-niche-map | pipeline-then-agent | — | **None** |
| competitor-buckets | pipeline-then-agent | — | **None** |
| competitor-metrics | pipeline-only | N/A | N/A (no agent) |
| search-demand | pipeline-only | ⚠️ declared but unused | N/A — `pipeline-only` never invokes LLM |
| phase1-baseline | pipeline-then-agent | — | **None** |
| method01-competitor-pages | pipeline-then-agent | — | **None** |
| method02-seed-expansion | pipeline-then-agent | — | **None** |
| method03-content-gap-import | pipeline-then-agent | — | **None** |
| consolidated-keywords | agent-only | — | **None** |
| verdict-strategy | agent-only | — | **None** |
| topical-map | agent-only | — | **None** |
| content-brief | pipeline-then-agent | — | **None** |
| content-article | pipeline-then-agent | — | **None** (`allowedTools: []`) |
| content-images | pipeline-only | N/A | N/A |

> **Note:** `content-article.agent.md` declares `execution_type: pipeline-then-agent` (corrected from previous audit which stated `agent-with-tools`). The agent has no tool access — article generation relies on the 3 Serper pre-fetch calls in the pipeline.

---

## Dead Tool Risk Register

Tools that are registered but not confirmed active in any current pipeline:

| Tool | Registered In | Last Known Use | Risk |
|------|--------------|----------------|------|
| `ahrefs_content_gap` | `ahrefs.service.ts` | method03 (TODO stub) | Low — method03 has early gate |
| `ahrefs_keyword_difficulty` | `search-demand.agent.md` frontmatter | ⚠️ **Never called** — `pipeline-only` step | 🟡 Medium — misleading to future devs |
| `ahrefs_keyword_volume` | `search-demand.agent.md` frontmatter | ⚠️ **Never called** — `pipeline-only` step | 🟡 Medium — misleading |
| `dataforseo_keyword_volume` | `search-demand.agent.md` frontmatter | ⚠️ **Never called** — `pipeline-only` step | 🟡 Medium — misleading |
| `dataforseo_keyword_difficulty` | `search-demand.agent.md` frontmatter | ⚠️ **Never called** — `pipeline-only` step | 🟡 Medium — misleading |
| `dataforseo_serp` | Tool registry | Not confirmed in any pipeline | 🟡 Medium — confirm or remove |

> **Root Cause for search-demand dead tools**: `execution_type: pipeline-only` means `workflow.processor.ts` calls only the pipeline function — the LLM is never invoked, so the `tools:` frontmatter array is never passed to `AgentRuntime`. The actual keyword data comes from `search-demand.pipeline.ts` Ahrefs calls, not from Claude tool calls. **Recommendation:** Remove the `tools:` block from `search-demand.agent.md` to eliminate confusion.

---

## Tool Budget Declarations in Prompts

Some prompts historically declared tool budgets (e.g., "serper_search max 3"). These are no longer used for `pipeline-then-agent` steps. Verify no active prompt contains a stale tool budget.

| Status | Prompt | Tool Budget Line |
|--------|--------|-----------------|
| ✅ Removed | `content/content-brief.prompt.md` | Was: "serper_search max 3, firecrawl_scrape max 2" |
| ✅ Removed | `research/phase1-baseline.prompt.md` | Was: "ahrefs_organic_keywords, ahrefs_keyword_difficulty, dataforseo_serp" |
| ✅ Removed | `research/method01-competitor-pages.prompt.md` | Was: "ahrefs_organic_pages, ahrefs_organic_keywords, dataforseo_serp, serper_search" |
| ✅ Removed | `research/method02-seed-expansion.prompt.md` | Was: "ahrefs_related_keywords, dataforseo_keyword_suggestions, serper_search, dataforseo_keyword_volume" |

---

## Tool Audit Checklist Template

- [ ] For each `agent-with-tools` step: verify `tools:` frontmatter in `.agent.md` lists only tools that exist in `tool.registry.ts`
- [ ] For each `pipeline-then-agent` / `agent-only` step: grep corresponding prompt for tool names — none should appear in active instructions
- [ ] `tool.sandbox.ts` correctly restricts each agent to its declared `tools:` list
- [ ] Dead tools (registered but unused): remove or document intentional reservation
- [ ] Credit cost estimates in `audit/performance.md` kept current with tool usage
