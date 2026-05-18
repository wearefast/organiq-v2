# Audit Feature

## Status: Deprecated in v2

The standalone audit pipeline (lead-magnet flow where visitors submit a URL and receive a free SEO/GEO/AEO report) has been **removed** in the OS-version1 greenfield rewrite.

`server/src/features/audit/` is an **empty directory** — no controller, service, or module exists.

## Where Audit Functionality Lives Now

Site-audit capabilities have been absorbed into the **18-step workflow pipeline** as **Step 3 — `site-audit`**:

| Aspect | Old (v1 Lead Magnet) | New (v2 Workflow Step) |
|--------|----------------------|------------------------|
| Entry point | Public URL submission form | Project-scoped workflow run |
| Execution | `AuditProcessor` (9-step pipeline) | `site-audit` agent (`.agent.md`) |
| Data flow | Self-contained `rawData` blob | Workflow context shared with downstream steps |
| Output | Standalone audit report page | Step artifact reviewed via human-in-the-loop approval |
| Credit cost | Free (lead magnet) | 60 credits |
| Dependencies | None (first action) | Depends on Step 1 (`business-profile`) |
| Tools used | Firecrawl, PageSpeed/CrUX, Lighthouse | Same tools via tool sandbox |

## Agent Definition

- **File**: `server/src/agents/definitions/site-audit.agent.md`
- **Model**: GPT-4o
- **Credit cost**: 60
- **Depends on**: `business-profile` (Step 1)
- **Requires approval**: Yes (human reviews before downstream steps use the data)

## What the Old Pipeline Docs Described

The remainder of this file previously documented a 9-step audit pipeline (scrape → profile → deep-read → PageSpeed → keyword chain → SERP discovery → competitor metrics → organic analysis → content gap), a control-room visualization UI, and a 5-tab results page. None of these exist in the current codebase.
