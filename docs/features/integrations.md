# Integrations

## External API Services

| Service | Purpose | API Docs |
|---------|---------|----------|
| Ahrefs v3 | Domain metrics, top pages, keyword expansion, content gap | [docs](https://docs.ahrefs.com/) |
| Serper.dev | Google SERP competitor discovery (replaced SerpAPI) | [docs](https://serper.dev/docs) |
| OpenAI (GPT-5.4) | Business profiling, keyword classification, competitor classification, report copy | [docs](https://platform.openai.com/docs) |
| PageSpeed Insights | Core Web Vitals, performance, SEO score | [docs](https://developers.google.com/speed/docs/insights/v5/get-started) |

## Ahrefs Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `/v3/site-explorer/overview` | Domain metrics (DR, traffic, backlinks) |
| `/v3/site-explorer/top-pages` | Competitor top pages |
| `/v3/site-explorer/keywords-by-traffic` | Top ranking keywords |
| `/v3/keywords-explorer/matching-terms` | Seed keyword expansion |
| `/v3/site-explorer/content-gap` | Content gap analysis |


## Rate Limiting

Redis token bucket per API to prevent quota exhaustion:
- Ahrefs: cached 7 days per domain
- SerpAPI: cached 24 hours per query
- Lead magnet: limited to 1 overview + 3 competitor overviews per audit

## Server Files

- `server/src/features/integrations/integrations.module.ts`
- `server/src/features/integrations/services/ahrefs.service.ts`
- `server/src/features/integrations/services/serp.service.ts`
- `server/src/features/integrations/services/openai.service.ts`
- `server/src/features/integrations/services/pagespeed.service.ts`
- `server/src/features/integrations/services/scraper.service.ts`
