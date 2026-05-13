# Feature: Reports

## Overview

Reports are PDF documents generated from workflow run data. They consolidate keyword research, competitor analysis, and strategic recommendations into downloadable, shareable documents.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/reports/reports.controller.ts` | REST API under `projects/:projectId/reports` |
| `server/src/features/reports/reports.service.ts` | CRUD + generate (template interpolation + sidecar PDF call) |
| `server/src/features/reports/reports.module.ts` | NestJS module |
| `server/src/prompts/reports/*.template.md` | Markdown report templates |
| `python-sidecar/routers/reports.py` | PDF rendering via ReportLab |
| `frontend/src/features/reports/services/reports.service.ts` | Frontend API service |
| `frontend/src/app/(dashboard)/workspaces/[wId]/projects/[pId]/reports/page.tsx` | Reports list + generate modal |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/:projectId/reports` | List all reports for a project |
| `GET` | `/projects/:projectId/reports/:id` | Get single report |
| `POST` | `/projects/:projectId/reports/generate` | Generate a new report |
| `GET` | `/projects/:projectId/reports/:id/download` | Download report as `{ base64, title }` JSON |
| `DELETE` | `/projects/:projectId/reports/:id` | Delete a report |

## Report Types

| Type | Template | Description |
|------|----------|-------------|
| `full_strategy` | `full-strategy.template.md` | Comprehensive SEO strategy with roadmap, quick wins, long-term priorities |
| `ai_visibility` | `ai-visibility.template.md` | AI/GEO/AEO opportunity analysis and optimization recommendations |
| `keyword_research` | `keyword-research.template.md` | Keyword research summary with scoring, intent distribution, funnel mapping |
| `content_plan` | `content-plan.template.md` | Content calendar, topical structure, publishing schedule |

## Generation Flow

```
1. User selects a completed workflow run + report type
2. Frontend calls POST /projects/:projectId/reports/generate
   { workflowRunId, type: 'full_strategy' }
3. ReportsService:
   a. Loads the Markdown template from server/src/prompts/reports/
   b. Fetches workflow context, project data, keyword stats
   c. Interpolates template variables ({{project_domain}}, {{keywords_count}}, etc.)
   d. Calls Python sidecar POST /reports/pdf with sections
   e. Stores base64 PDF in reports table (filePath column)
   f. Returns report metadata
4. User clicks Download
   → GET /reports/:id/download
   → Returns { base64, title } as JSON
   → Frontend decodes base64 → creates Blob → triggers download
```

## Data Model

### reports table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| projectId | UUID | FK → projects |
| workflowRunId | UUID | FK → workflow_runs (nullable) |
| type | enum | full_strategy, ai_visibility, keyword_research, content_plan |
| title | text | Report title |
| filePath | text | Base64-encoded PDF data (see Known Issue below) |
| generatedAt | timestamp | When the PDF was generated |

### Known Issue: filePath Column Misuse
The `filePath` column stores base64 PDF data directly instead of a file path. This is a semantic mismatch documented in the technical debt tracker. Future fix: either rename to `pdfData` or store PDFs in object storage and use `filePath` for the actual path.

## Python Sidecar — PDF Endpoint

**POST /reports/pdf**

Request:
```json
{
  "title": "SEO Strategy Report",
  "project_domain": "example.com",
  "report_type": "full_strategy",
  "sections": [
    { "title": "Executive Summary", "content": "...", "level": 1 },
    { "title": "Keyword Analysis", "content": "...", "level": 2 }
  ]
}
```

Response:
```json
{
  "pdf_base64": "JVBERi0xLjQK...",
  "page_count": 12,
  "file_size_bytes": 245000
}
```
