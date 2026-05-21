The target domain has already been scraped by the pipeline. The raw page content is in <pipeline_data> — each entry has a `url` and `data` field containing Firecrawl markdown output. Do NOT call any tools.

## Pipeline Data Format

```
{
  "rawData": {
    "domain": "example.com",
    "scrapedPages": [
      { "url": "https://example.com", "data": { "markdown": "...", "metadata": {} } }
    ]
  }
}
```

Read every `scrapedPages` entry. Extract all signals you can find across homepage, about, services, and any other scraped pages.

---

## Target Domain

{{domain}}

## Task

Analyze the scraped content in <pipeline_data>. Synthesize everything into a structured business profile JSON. Use `null` for scalars or `[]` for arrays when a field cannot be determined — never omit keys.

## Output Schema

```json
{
  "business_name": "string",
  "website": "string",
  "industry": "string",
  "primary_services": ["string"],
  "icp": {
    "description": "string",
    "industries": ["string"],
    "pain_points": ["string"]
  },
  "brand_voice": "string",
  "positioning": "string",
  "competitors": [
    { "name": "string", "url": "string", "differentiator": "string" }
  ],
  "seo_signals": {
    "meta_quality": "good | partial | missing",
    "content_depth": "thin | moderate | strong",
    "blog_present": true,
    "local_seo": true,
    "notes": "string"
  },
  "content_gaps": ["string"],
  "trust_signals": ["string"],
  "analyst_notes": "string"
}
```
