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
| Step 05 — Direct Competitor Analysis | `AhrefsService.getDomainOverview()` | Ahrefs domain metrics |
| Step 06 — Organic Competitor Analysis | `AhrefsService.getTopPages()` | Ahrefs top pages + content |
| Step 07 — Competitor Metrics Sheet | Dashboard table view | Stored in `KeywordProject.competitors` |

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
| Content Gap | Ahrefs Content Gap Tool | `AhrefsService.getContentGap()` |

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
