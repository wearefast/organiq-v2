# Content Feature

## Overview

Content engine that generates SEO-optimised briefs and full articles from approved keywords using OpenAI GPT-5.4.

## Workflow

1. User selects an approved keyword
2. Triggers brief generation → `content-queue` → `OpenAIService.generateContentBrief()`
3. Reviews brief in dashboard
4. Triggers article generation → `content-queue` → `OpenAIService.generateArticle()`
5. Human reviews article
6. Approves → published status

## Content Statuses

| Status | Description |
|--------|-------------|
| `brief` | Brief generated, awaiting review |
| `draft` | Article generated, in draft |
| `review` | Under human review |
| `approved` | Approved, ready to publish |
| `published` | Published to CMS |

## Server Files

- `server/src/features/content/content.module.ts`
- `server/src/features/content/content.controller.ts`
- `server/src/features/content/content.service.ts`

## Frontend Files

- `frontend/src/features/content/services/content.service.ts`
