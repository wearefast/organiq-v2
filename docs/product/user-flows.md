# User Flows

## Lead Magnet (Public — No Login)

```
Visitor → /audit form → POST /leads → Create Lead + Audit →
  Enqueue audit-queue → Worker processes 10 steps →
  Scores calculated
```

**Steps:**
1. Visitor fills in website URL, name, email, business description
2. Frontend submits to `POST /leads`
3. Server creates Lead + Audit records, enqueues audit job
4. Frontend polls `GET /audits/:id/status` every 3 seconds
5. Progress bar updates with step name + percentage
6. On completion, score cards display (technical SEO, content coverage, backlink authority, AEO/GEO readiness)

## Keyword Research (Dashboard — Authenticated)

```
User → Create Project → Add seed keywords →
  Trigger discover → keyword-queue → Worker pulls from Ahrefs/SerpAPI →
  Stores keywords with intent/funnel tagging
```

**Steps:**
1. User creates a keyword project with seed keywords and competitors
2. Triggers discovery (Ahrefs matching terms + SerpAPI)
3. Worker processes in background via BullMQ
4. Keywords stored with KD, volume, intent, funnel stage
5. User can trigger gap analysis against competitors

## Content Engine (Dashboard — Authenticated)

```
Approved keyword → Generate brief (OpenAI) → content-queue →
  Generate article (OpenAI, E-E-A-T) → Human review →
  Approve & Publish
```

**Steps:**
1. User selects approved keyword, triggers brief generation
2. OpenAI generates structured content brief
3. User triggers full article generation
4. Article follows E-E-A-T guidelines
5. Human reviews and approves
