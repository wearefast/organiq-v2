# Agent Flow Audit — Pulse OS

> **Last audited:** June 4, 2026 (Release 16 — CTO Deep Audit Round 3)
> **Auditor:** CTO / Principal Engineer

This document maps the full 17-step agent execution flow: what each step reads, how it executes, what it writes to `workflowContext`, and which downstream steps depend on it.

---

## Critical Architecture Facts

**For `pipeline-then-agent` steps:** Only the Claude agent's structured JSON output is stored in `workflowContext[stepKey]`. The pipeline's `rawData` is NOT stored. Downstream steps reading `context['some-step']` receive the Claude output, not the pipeline output.

**For `pipeline-only` steps:** The full pipeline output IS stored in `workflowContext[stepKey]`. No LLM layer.

**`business-profile` is NOT a step.** It is seeded from `project.businessProfile` when the run starts. It is available in context as `context['business-profile']` but is NEVER executed as a BullMQ job. The old docs listing it as "Step 1" are incorrect.

**Context slicing (STEP_CONTEXT_KEYS):**

| Step | Sliced To | Status |
|------|-----------|--------|
| `consolidated-keywords` | seed-keywords, method01-03, phase1-baseline | ✅ R12 |
| `verdict-strategy` | business-profile, site-audit, ai-intelligence, competitor-buckets/metrics, consolidated-keywords | ✅ R12 |
| `topical-map` | consolidated-keywords, verdict-strategy, business-profile | ✅ R12 |
| `content-brief` | topical-map, business-profile | ✅ R13 |
| `content-article` | content-brief, business-profile | ✅ R13 |
| `content-images` | ❌ **MISSING** — receives full 80-100K token context | ⚠️ R16 gap |

**R16 gap:** `content-images` reads only `content-article.imageAltSuggestions`, `content-article.content`, and `business-profile`. Add `'content-images': ['content-article', 'business-profile']` to `STEP_CONTEXT_KEYS`.

**⚠️ R16-C1 — Image storage:** `content-images` step outputs 15-30 MB base64 PNG blobs stored in `step_artifacts.data` (JSONB) AND `workflow_context`. Neither is appropriate for binary image data. Fix: strip `images[*].base64` before persisting; images already materialized to `content_images` table rows.

This distinction is the root cause of all context-read bugs. Always verify which execution type a step uses before writing a context read.

---

## Pre-Run Bootstrap

| Key | Source | Note |
|-----|--------|------|
| `domain` | `project.domain` | |
| `country` | `project.country` | |
| `language` | `project.language` | |
| `industry` | `project.industry` | |
| `business-profile` | `project.businessProfile` | ⚠️ May be stale — generated at profile analysis time, not at run time |

---
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | Ahrefs `getOrganicKeywords` + `getRelatedKeywords` + `getKeywordSuggestions` |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['business-profile']` |
| **Context writes** | `{ seedKeywords: [{ keyword, volume, difficulty, currentPosition, intent }], categories[], totalCount }` |
| Downstream readers | serp-niche-map, phase1-baseline (keywords), method02-seed-expansion, method03 |
| Approval required | ✅ |

---

### Step 3 — `site-audit`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | PageSpeed + CrUX + Ahrefs |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['business-profile']` |
| **Context writes** | `{ overallScore, issues[], coreWebVitals, technicalSeo, ... }` |
| Downstream readers | ai-intelligence, verdict-strategy |
| Approval required | ✅ |

---

### Step 4 — `ai-intelligence`
| Property | Value |
|----------|-------|
| Execution type | `agent-with-tools` |
| Pipeline | none |
| Agent model | Claude (tools enabled) |
| Context reads | `context['site-audit']` |
| **Context writes** | intelligence profile (brand sentiment, competitive positioning, etc.) |
| Downstream readers | competitor-metrics, verdict-strategy |
| Approval required | ✅ |

---

### Step 5 — `serp-niche-map`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | Ahrefs `getSerpOverview` × ≤20 seed keywords |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['seed-keywords'].seedKeywords[]` |
| **Context writes** | SERP niche segments and competitor signals |
| Downstream readers | competitor-buckets |
| Approval required | — |
| **R12 note** | Capped at 20 seeds (was 50). Reads `seedCtx?.seedKeywords` first (correct path). |

---

### Step 6 — `competitor-buckets`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | Serper SERP data |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['serp-niche-map']` |
| **Context writes** | `{ buckets: { direct: { competitors: [{ domain }] }, content: { competitors: [{ domain }] } } }` |
| Downstream readers | competitor-metrics, method01-competitor-pages, method03 |
| Approval required | ✅ |

---

### Step 7 — `competitor-metrics`
| Property | Value |
|----------|-------|
| Execution type | **`pipeline-only`** (no LLM) |
| Pipeline | Ahrefs `getDomainRating` + `getBacklinks` + `getOrganicKeywords(×20)` per competitor |
| Agent model | None |
| Context reads | `context['competitor-buckets'].buckets`, `context['business-profile'].domain_authority` |
| **Context writes (full pipeline output)** | `{ competitorMetrics: [{ domain, domainRating, organicKeywords, referringDomains, backlinks, keywords: [{ keyword, volume, difficulty, position, url }], topPages, status }], targetMetrics: { domain, domainRating, referringDomains }, gaps: {...}, avgCompetitorDR }` |
| Downstream readers | method01-competitor-pages (reads `keywords[]`), verdict-strategy |
| Approval required | — |
| **R12 note** | Fixed target DR path: was `.rawData.domainAuthority.domain_rating`, now `.domain_authority.domain_rating`. Added `keywords[]` array per competitor (was discarded). |

---

### Step 8 — `search-demand`
| Property | Value |
|----------|-------|
| Execution type | **`pipeline-only`** (no LLM) |
| Pipeline | DataForSEO/Ahrefs volume + difficulty batch |
| Agent model | None |
| Context reads | `context['seed-keywords']` |
| **Context writes (full pipeline output)** | `{ enrichedKeywords[], highOpportunity[] }` |
| Downstream readers | phase1-baseline |
| Approval required | — |

---

### Step 9 — `phase1-baseline`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | 0–1 Ahrefs calls (keywords from context if available; always calls `getOrganicPages`) |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['seed-keywords'].seedKeywords[]`, `context['competitor-metrics']`, `context['search-demand']` |
| **Context writes** | `{ currentRankings[], keywordGaps[], quickWins[], competitorOverlap, intentDistribution, summary }` |
| Downstream readers | method01, method02, method03, consolidated-keywords |
| Approval required | ✅ |
| **R12 note** | Skips `getOrganicKeywords` when `seed-keywords` context has data. `metadata.organicKeywordsSource` field indicates which path was taken. |

---

### Step 10 — `method01-competitor-pages`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | Ahrefs `getOrganicPages` × N competitors |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['competitor-buckets'].buckets`, `context['competitor-metrics'].competitorMetrics[].keywords[]` |
| **Context writes** | `{ competitorPages[], discoveredKeywords[], topicClusters[], contentPatterns[], summary }` |
| Downstream readers | consolidated-keywords |
| Approval required | — |
| **R12 note** | Reads `keywords[]` from `competitor-metrics` context. Pipeline shape changed to `{ domain, pages, keywords }` per competitor. Prompt corrected (rule 1, step-by-step, data availability note). |

---

### Step 11 — `method02-seed-expansion`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | **0 API calls** — reads from `seed-keywords` context |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['seed-keywords'].seedKeywords[]` |
| **Context writes** | `{ expandedKeywords[], expansionByMethod, topicClusters[], questionKeywords[], summary }` |
| Downstream readers | consolidated-keywords |
| Approval required | — |
| **R12 note** | Fully rewritten. No AhrefsService/DataForSeoService dependency. Zero constructor parameters. |

---

### Step 12 — `method03-content-gap-import`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | Ahrefs content gap API (only if `imported-keywords` in context) |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['imported-keywords']`, `context['competitor-buckets']` |
| **Context writes** | `{ importedKeywords[], importStats, bySource[], topicClusters[], summary, skipped: boolean }` |
| Downstream readers | consolidated-keywords |
| Approval required | — |
| **R12 note** | Early gate: returns empty result with `skipped: true` if `context['imported-keywords']` is absent or empty array. |

---

### Step 13 — `consolidated-keywords`
| Property | Value |
|----------|-------|
| Execution type | **`agent-only`** |
| Pipeline | none |
| Agent model | Claude extended thinking (`allowedTools: []`) |
| Context reads (sliced) | `seed-keywords`, `method01-competitor-pages`, `method02-seed-expansion`, `method03-content-gap-import`, `phase1-baseline` |
| **Context writes** | `{ masterKeywordList[], clusters[], priorityGroups, intentBreakdown, summary }` |
| Downstream readers | verdict-strategy, topical-map |
| Approval required | ✅ |
| **R12 note** | Context sliced to 5 declared keys only (was receiving full workflowContext). |

---

### Step 14 — `verdict-strategy`
| Property | Value |
|----------|-------|
| Execution type | **`agent-only`** |
| Pipeline | none |
| Agent model | Claude extended thinking (`allowedTools: []`) |
| Context reads (sliced) | `business-profile`, `site-audit`, `ai-intelligence`, `competitor-buckets`, `competitor-metrics`, `consolidated-keywords` |
| **Context writes** | `{ verdict, SWOT, priorityMatrix, actionPlan, KPIs }` |
| Downstream readers | topical-map |
| Approval required | ✅ |
| **R12 note** | Context sliced to 6 declared keys only. |

---

### Step 15 — `topical-map`
| Property | Value |
|----------|-------|
| Execution type | **`agent-only`** |
| Pipeline | none |
| Agent model | Claude extended thinking (`allowedTools: []`) |
| Context reads (sliced) | `consolidated-keywords`, `verdict-strategy`, `business-profile` |
| **Context writes** | `{ pillars[], calendar[], linkingArchitecture }` |
| Downstream readers | content-brief |
| Approval required | ✅ |
| **R12 note** | Context sliced to 3 declared keys only. |

---

### Step 16 — `content-brief`
| Property | Value |
|----------|-------|
| Execution type | `pipeline-then-agent` |
| Pipeline | Serper `search` + Firecrawl `scrape` (top 3 pages for target keyword) |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['topical-map'].calendar` (selects target keyword) |
| **Context writes** | `{ targetKeyword, secondaryKeywords, searchIntent, serpAnalysis, contentStructure, wordCountTarget, keywordTargets, schemaMarkup, internalLinks, externalReferences, competitiveGaps, paaQuestions, ctaRecommendations, metaTitle, metaDescription, summary }` |
| Downstream readers | content-article |
| Approval required | ✅ |
| **🔴 CRITICAL BUG (R13)** | Pipeline reads target keyword from `context['verdict-strategy'].contentPlan[0].targetKeyword` — this field does NOT exist in the verdict-strategy output schema. `context.targetKeyword` is also never set. Result: pipeline always returns `{ rawData: { serpResults: null, scrapedPages: [] } }`. The agent writes a brief with hallucinated SERP analysis. Fix: read from `context['topical-map'].calendar?.[0]?.pieces?.[0]?.keyword`. |

---

### Step 17 — `content-article`
| Property | Value |
|----------|-------|
| Execution type | **`pipeline-then-agent`** (NOT `agent-with-tools` — see agent.md) |
| Pipeline | Serper ×3 searches (stats, news, PAA) for the target keyword |
| Agent model | Claude (`allowedTools: []`) |
| Context reads | `context['content-brief'].targetKeyword` ✅ (correctly reads from content-brief output) |
| **Context writes** | Full article JSON |
| Downstream readers | content-images |
| Approval required | ✅ |
| **Note** | Context for this step is NOT sliced — receives all 15 prior step outputs (~80–100K tokens). `STEP_CONTEXT_KEYS` should be extended to include only `content-brief` and `topical-map`. |

---

## Context Slicing Map

Defined in `STEP_CONTEXT_KEYS` in `server/src/features/workflows/workflow.processor.ts`.

When a step has declared context keys, `buildUserMessage()` in `agent.runtime.ts` filters `workflowContext` to only include those keys before building the `<workflow_context>` block.

```typescript
const STEP_CONTEXT_KEYS: Record<string, string[]> = {
  'consolidated-keywords': [
    'seed-keywords', 'method01-competitor-pages', 'method02-seed-expansion',
    'method03-content-gap-import', 'phase1-baseline',
  ],
  'verdict-strategy': [
    'business-profile', 'site-audit', 'ai-intelligence',
    'competitor-buckets', 'competitor-metrics', 'consolidated-keywords',
  ],
  'topical-map': [
    'consolidated-keywords', 'verdict-strategy', 'business-profile',
  ],
};
```

Steps not listed receive the full `workflowContext` (backward-compatible).

---

## Audit Checklist Template

When auditing agent flow:

- [ ] For each `pipeline-then-agent` step: verify context reads use Claude agent output schema (not `rawData.*`)
- [ ] For each `pipeline-only` step: verify context reads use pipeline output schema directly
- [ ] `STEP_CONTEXT_KEYS` entries match the `depends_on` array in each `.agent.md` (no missing keys, no extra keys for steps that don't exist yet)
- [ ] Every context read has a fallback (optional chaining + nullish coalescing)
- [ ] No step reads from `context[stepKey].rawData` for pipeline-then-agent steps (rawData is never stored)
- [ ] Prompt for each step accurately describes the `<pipeline_data>` schema actually produced by the pipeline
- [ ] Anti-hallucination rules do not reference blocked tools
