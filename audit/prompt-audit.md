# Prompt Audit — Pulse OS

> **Last audited:** June 4, 2026 (Release 13 — CTO Deep Audit)
> **Auditor:** CTO / Principal Engineer
> **Prompt directory:** `server/src/prompts/`

---

## Audit Scope

For each active prompt file, verify:
1. **Execution model** declared in prompt matches actual runtime (`execution_type` in `.agent.md`)
2. **Tool availability** — `allowedTools: []` for `pipeline-then-agent` and `agent-only` steps; no stale tool references in those prompts
3. **Data source accuracy** — pipeline data shape described in prompt matches what the pipeline actually returns
4. **Anti-hallucination rules** — no rule that contradicts available data (e.g. "keywords MUST come from tool responses" when tools are blocked)
5. **Output schema** — prompt schema matches `OutputValidator` expectations

---

## Prompt Inventory (Post-R12)

### Discovery & Intelligence

| Prompt File | Step Key | Exec Type | Tools Available | Last Verified | Status |
|-------------|----------|-----------|-----------------|---------------|--------|
| `discovery/business-profile.prompt.md` | business-profile | pipeline-then-agent | ✅ (Claude tools) | R12 | ✅ |
| `discovery/seed-keywords.prompt.md` | seed-keywords | pipeline-then-agent | ❌ (`allowedTools: []`) | R12 | ✅ |
| `audit/site-audit.prompt.md` | site-audit | pipeline-then-agent | ❌ | R12 | ✅ |
| `intelligence/ai-intelligence.prompt.md` | ai-intelligence | agent-with-tools | ✅ | R12 | ✅ |

### Competitors

| Prompt File | Step Key | Exec Type | Tools Available | Last Verified | Status |
|-------------|----------|-----------|-----------------|---------------|--------|
| `competitors/serp-niche-map.prompt.md` | serp-niche-map | pipeline-then-agent | ❌ | R12 | ✅ |
| `competitors/competitor-buckets.prompt.md` | competitor-buckets | pipeline-then-agent | ❌ | R12 | ✅ |
| `competitors/competitor-metrics.prompt.md` | competitor-metrics | **pipeline-only** | N/A (never loaded) | R12 | ✅ — labelled "documentation only" |

### Research

| Prompt File | Step Key | Exec Type | Tools Available | Last Verified | Status |
|-------------|----------|-----------|-----------------|---------------|--------|
| `research/phase1-baseline.prompt.md` | phase1-baseline | pipeline-then-agent | ❌ | R12 | ✅ — tool references removed |
| `research/method01-competitor-pages.prompt.md` | method01-competitor-pages | pipeline-then-agent | ❌ | R12 | ✅ — 3 defects fixed (rule 1, step-by-step, data note) |
| `research/method02-seed-expansion.prompt.md` | method02-seed-expansion | pipeline-then-agent | ❌ | R12 | ✅ — tool references removed, pipeline shape updated |
| `research/method03-content-gap.prompt.md` | method03-content-gap-import | pipeline-then-agent | ❌ | R12 | ✅ |

### Strategy

| Prompt File | Step Key | Exec Type | Tools Available | Last Verified | Status |
|-------------|----------|-----------|-----------------|---------------|--------|
| `strategy/consolidated-keywords.prompt.md` | consolidated-keywords | agent-only | ❌ | R12 | ✅ |
| `strategy/verdict-strategy.prompt.md` | verdict-strategy | agent-only | ❌ | R12 | ✅ |
| `topical-map/topical-map.prompt.md` | topical-map | agent-only | ❌ | R12 | ✅ |

### Content

| Prompt File | Step Key | Exec Type | Tools Available | Last Verified | Status |
|-------------|----------|-----------|-----------------|---------------|--------|
| `content/content-brief.prompt.md` | content-brief | pipeline-then-agent | ❌ | R13 | ⚠️ Pipeline data shape mismatch — see below |
| `articles/content-article.prompt.md` | content-article | **pipeline-then-agent** | ❌ (no tools) | R13 | ✅ — verified pipeline shape matches prompt |

---

## Anti-Hallucination Rule Audit

The following rules are the highest-risk failure modes. For any prompt with `allowedTools: []`, check that no anti-hallucination rule requires data to come exclusively from tool responses.

| Prompt | Rule | Status |
|--------|------|--------|
| method01-competitor-pages | Rule 1: "keywords MUST trace to `pipeline_data.rawData.competitorPagesResults[].keywords[]`" | ✅ Corrected R12 |
| method02-seed-expansion | Rule 1: "keywords MUST trace to pipeline_data or a tool response" | ✅ |
| phase1-baseline | Rule 2: "NEVER fabricate keywords — every keyword MUST trace to pipeline_data or tool response" | ✅ |
| content-brief | N/A — no keyword anti-hallucination rule | ✅ |

---

## Pipeline Data Shape Accuracy

The most common prompt defect: prompt describes a data shape that differs from what the pipeline actually returns.

| Prompt | Described Shape | Actual Shape | Match |
|--------|-----------------|--------------|-------|
| method01-competitor-pages | `{ domain, pages, keywords: [{ keyword, volume, difficulty, position, url }] }` | Matches (`Method01CompetitorPagesPipeline` returns `{ domain, pages, keywords }`) | ✅ |
| method02-seed-expansion | `{ rawData: { seedKeywords: [{ keyword, volume, difficulty, currentPosition, intent }] } }` | Matches (`Method02SeedExpansionPipeline` returns this shape) | ✅ |
| phase1-baseline | `<pipeline_data>` contains organic keywords + pages | Matches (returns `{ rawData: { organicKeywords, organicPages } }`) | ✅ |
| content-brief | `{ rawData: { targetKeyword, serpResults: { organic: [{...}] }, scrapedPages: [{url, data}] } }` | **🔴 BROKEN** — pipeline reads `context['verdict-strategy'].contentPlan[0].targetKeyword` which doesn't exist; always returns `{ rawData: { serpResults: null, scrapedPages: [] } }` | ❌ MISMATCH |
| competitor-metrics | Labelled documentation-only — not loaded at runtime | N/A | ✅ |

---

## Prompt Audit Checklist Template

Use this checklist when auditing a prompt file:

- [ ] `execution_type` in corresponding `.agent.md` noted
- [ ] If `pipeline-then-agent` or `agent-only`: confirm no tool names appear in active instructions
- [ ] If `pipeline-then-agent`: confirm `<pipeline_data>` shape description matches actual pipeline return value
- [ ] Anti-hallucination rules do not reference unavailable data sources
- [ ] Step-by-step workflow does not instruct tool calls that are blocked
- [ ] `return_output` tool call instruction is present (required for all steps using `OutputValidator`)
- [ ] Output schema in prompt matches the `OutputValidator` JSON schema for this step
- [ ] `{{variable}}` template tokens are all populated by the agent runtime before sending to Claude
- [ ] No stale step references (e.g., referencing a step that was removed or renamed)

---

## Known Prompt Risks (Open Items)

| Prompt | Risk | Priority |
|--------|------|----------|
| `content/content-brief.prompt.md` | 🔴 **CRITICAL**: Pipeline always returns empty `serpResults` + `scrapedPages`. Claude generates competitive analysis without any real SERP or page data. Every content brief is hallucinated. | Critical — fix `content-brief.pipeline.ts` line ~32 |
| `content/content-brief.prompt.md` | Once pipeline is fixed, verify prompt anti-hallucination rules enforce use of `serpResults`/`scrapedPages` from `pipeline_data.rawData` | High |
| `search-demand.agent.md` | `tools:` frontmatter block lists 4 tools that are never invoked (`pipeline-only` exec). Dead metadata misleads future devs. | Low — remove `tools:` block |
| Any future `pipeline-then-agent` step | Adding a new step with `allowedTools: []` but not updating the prompt = silent degradation | High — add to PR checklist |

### Content-Brief Pipeline Fix (Action Required)

**File:** `server/src/features/workflows/pipelines/content-brief.pipeline.ts` line ~32

**Current (broken):**
```typescript
const briefCtx = context['verdict-strategy'] as { contentPlan?: Array<{ targetKeyword: string }> } | undefined;
const targetKeyword = briefCtx?.contentPlan?.[0]?.targetKeyword || '';
```

**`verdict-strategy` output schema does NOT have `contentPlan`.** Actual schema:
```
{ executiveSummary, swot, verdict, aiGeoReadiness, riskAssessment, priorityMatrix, actionPlan, kpis, budgetAllocation }
```

**Fix — read from topical-map calendar:**
```typescript
const topicalMap = context['topical-map'] as {
  calendar?: Array<{
    month: number; label: string;
    pieces: Array<{ title: string; keyword: string; pillar: string; cluster: string; contentType: string; priority: string; }>;
  }>;
} | undefined;
const targetKeyword = topicalMap?.calendar?.[0]?.pieces?.[0]?.keyword || '';
```

**topical-map output schema (confirmed):**
```
{ pillars[], calendar: [{ month, label, pieces: [{ title, keyword, pillar, cluster, contentType, priority }] }], linkingArchitecture, stats, summary }
```

---

## Change Log

| Date | Release | File | Change |
|------|---------|------|--------|
| June 4, 2026 | R12 | `research/phase1-baseline.prompt.md` | Removed blocked tool references, added pipeline data note |
| June 4, 2026 | R12 | `research/method01-competitor-pages.prompt.md` | Fixed rule 1 (tool → pipeline_data), fixed step-by-step workflow, updated data availability note |
| June 4, 2026 | R12 | `research/method02-seed-expansion.prompt.md` | Removed tool references, updated to reflect `rawData.seedKeywords` shape |
| June 4, 2026 | R12 | `content/content-brief.prompt.md` | Fixed 4 stale tool references (Instructions 1-2, Task section, Target Market line) |
| June 4, 2026 | R12 | `competitors/competitor-metrics.prompt.md` | Relabelled as "Pipeline-only (no LLM) — documentation only" |
| June 4, 2026 | R13 | `articles/content-article.prompt.md` | Corrected exec type — `pipeline-then-agent` not `agent-with-tools`. Pipeline (3 Serper calls) verified working. No tool access in agent. |
| June 4, 2026 | R13 | `content/content-brief.prompt.md` | Flagged critical: pipeline `targetKeyword` always empty → SERP data never fetched → content brief hallucinated. |
| June 4, 2026 | R13 | `search-demand.agent.md` | Flagged: `tools:` frontmatter is dead metadata — `pipeline-only` never invokes Claude. |
