# Keywords Feature

## Overview

Keyword research pipeline digitised from the SEO Keyword Research SOP. Users create projects, discover keywords via Ahrefs/SerpAPI, and build topical maps.

## Pipeline Steps (from SOP)

| SOP Step | Pipeline Action | Implementation |
|----------|----------------|----------------|
| Step 01 — AI Business Profile | `OpenAIService.generateBusinessProfile()` | OpenAI GPT-5.4 with website content |
| Step 02 — Deep-Read Profile | Manual review in dashboard | UI display of generated profile |
| Step 03 — Seed Keywords | Extracted from business profile | `audit.seedKeywords[]` |
| Step 04 — SERP Competitors | `SerpApiService.discoverCompetitors()` | SerpAPI Google search |
| Step 05 — Direct Competitor Metrics | `AuditProcessor` + `AhrefsService.getDomainOverview()` | Ahrefs domain metrics + top pages for direct competitors |
| Step 06 — Organic Competitor Analysis | `AuditProcessor` + `AhrefsService.getOrganicCompetitors()` | Ahrefs overlap metrics + top pages, GPT fallback |
| Step 07 — Content Gap | `AuditProcessor` + `AhrefsService.getOrganicKeywords()` | Persisted `keywordPool` vs usable competitor keyword sets |

## Phase 1 — Reverse-Engineer URLs

| Method | Tool | Implementation |
|--------|------|----------------|
| Existing page analysis | Ahrefs Site Explorer | `AhrefsService.getTopPages(ownDomain)` |
| Category/service keywords | Ahrefs keywords-by-traffic | `AhrefsService.getDomainOverview()` |

## Phase 2 — Topical Map Build

| Method | Tool | Implementation |
|--------|------|----------------|
| Competitor Top Pages | Ahrefs Site Explorer per competitor | `AhrefsService.getTopPages()` loop |
| Seed Keywords | Ahrefs Keywords Explorer | `AhrefsService.getMatchingTerms()` |
| Content Gap | Audit Step 07 over Ahrefs organic keywords | `AuditProcessor` ranks competitors, probes `AhrefsService.getOrganicKeywords()`, and computes the overlap locally |

## Implemented Step 07 Logic

Step 07 in the audit pipeline currently works as follows:

1. Persist the merged Ahrefs keyword pool from Step 04 to `rawData.keywordPool`.
2. Treat the client's top-50 ranked keywords as the covered set.
3. Build ranked direct and organic competitor pools from the Step 05-06 outputs.
4. Rank candidates by usable footprint and overlap signals before DR.
5. Probe each candidate with `AhrefsService.getOrganicKeywords(domain, country, 200)`.
6. Skip competitors that return no top-20 keywords with volume >= 10, then backfill from the next ranked candidate.
7. Create primary gap keywords when 2+ competitors rank and the client does not.
8. Create `emergingOpportunities` when only 1 usable competitor ranks for the keyword.

This means Step 07 is resilient to marketplace-style competitors that classify well in SERP discovery but have no usable country-specific organic keyword footprint for gap analysis.

## Intent Categories

| Category | Filter |
|----------|--------|
| Transactional | `intent=TRANSACTIONAL` |
| Commercial | `intent=COMMERCIAL` |
| Informational | `intent=INFORMATIONAL` |
| Navigational | `intent=NAVIGATIONAL` |

## Server Files

- `server/src/features/keywords/keywords.module.ts`
- `server/src/features/keywords/keywords.controller.ts`
- `server/src/features/keywords/keywords.service.ts`

## Frontend Files

- `frontend/src/features/keywords/services/keywords.service.ts`
