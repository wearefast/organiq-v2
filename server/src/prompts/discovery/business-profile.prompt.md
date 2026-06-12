The target domain has already been scraped by the pipeline. The raw page content is in <pipeline_data> — each entry has a `url` and `data` field containing Firecrawl markdown output. Do NOT call any tools.

## Pipeline Data Format

```
{
  "rawData": {
    "domain": "example.com",
    "scrapedPages": [
      { "url": "https://example.com", "data": { "markdown": "...", "metadata": {} } }
    ],
    "sitemapUrls": ["https://example.com/page1", ...]
  }
}
```

Read **every** `scrapedPages` entry thoroughly. Extract all signals across every page — homepage, about, services, blog, contact, and all other scraped pages. The more pages available, the richer your analysis should be.

---

## Target Domain

{{domain}}

## Task

Analyze the scraped content in <pipeline_data>. Synthesize everything into a structured business profile JSON. Use `null` for scalars or `[]` for arrays when a field cannot be determined — never omit keys.

### Extraction rules

- **primary_market**: A SHORT label (max 5 words) for the geographic or demographic target market, e.g. "UAE / Middle East", "US SMBs", "Global B2B SaaS". Do NOT write a paragraph. Extract from phone codes, currency, language locale, location mentions, and audience copy. Never leave as null if there are ANY signals.
- **competitors**: First, extract every competitor, alternative, or comparison explicitly mentioned across ALL scraped pages (blog posts, case studies, comparison pages, FAQs, testimonials). If the scraped content contains zero competitor mentions (common for financial institutions, enterprise B2B, and regulated industries that never name rivals on their own site), then use your general knowledge to list the most well-known direct competitors operating in the same industry and primary market. Set `differentiator` to `"inferred — not mentioned on site"` for these entries. Aim for 5–10 entries; never leave this array empty when industry and primary_market are known.
- **social_media**: Scan every page footer, header, contact page, and about page for social media links. Look for SVG icons, <a> tags with platform domains (tiktok.com, facebook.com, instagram.com, x.com, twitter.com, linkedin.com, youtube.com), and icon classes (fa-facebook, fa-twitter, etc.). Extract platform name and full URL for every link found. Mark each entry with `"source": "scraped"` if extracted from page content, or `"source": "inferred"` if supplemented.

  **MANDATORY — after extracting scraped links, attempt to resolve ALL 7 platforms below for every brand.** Firecrawl markdown often drops icon-only footer links with no visible text, so you must supplement with inferred profiles. For each platform not already found in scraped content, construct the most likely profile URL from the brand handle (use the brand name slug, e.g. if brand is "LuvinDeals" → handle is "luvindeals"):
  - **LinkedIn**: `https://www.linkedin.com/company/{handle}`
  - **X (Twitter)**: `https://x.com/{handle}` — ALWAYS include this; virtually every brand has X/Twitter
  - **Facebook**: `https://www.facebook.com/{handle}`
  - **Instagram**: `https://www.instagram.com/{handle}`
  - **YouTube**: `https://www.youtube.com/@{handle}`
  - **TikTok**: `https://www.tiktok.com/@{handle}`
  - **Pinterest**: `https://www.pinterest.com/{handle}` (include only for consumer/lifestyle/fashion/food brands)

  Set `"source": "inferred"` for any platform not directly found in scraped page content. Never return fewer than 4 platforms for any consumer-facing brand.
- **sitemap_urls**: Copy the `sitemapUrls` array from `pipeline_data.rawData.sitemapUrls` verbatim into this field.
- **logo_url**: Scan all scraped pages for the site's logo. Look for `<img>` tags with "logo" in class/id/alt/src, or OpenGraph `og:image` meta tags, or `<link rel="icon">` with large sizes. Return the full absolute URL of the best quality logo found. If none found, return `null`.
- **analyst_notes**: Summarise coverage honestly — mention how many pages were scraped, key data sources used, and any confidence gaps. Structure it clearly: start with a brief summary sentence, then list HIGH confidence items, MODERATE confidence items, and LOW confidence items separately.
- **competitors entries**: Each competitor object must include `type` (one of `direct`, `indirect`, or `aspirational`) and `content_strength` (one of `weak`, `moderate`, or `strong`). Set `type` to `direct` if they serve the same primary audience and use case, `indirect` if adjacent, `aspirational` if they are market leaders the business is positioning against. Use your general knowledge to assess `content_strength` based on the breadth and quality of their content marketing.
- **eeat_signals**: Evaluate the business's Expertise, Experience, Authority, and Trustworthiness signals from all scraped pages. Score `about_page_quality` as `thin` (few sentences, generic), `detailed` (substantial team/history/mission), or `comprehensive` (deep bios, credentials, case studies). Set `team_or_author_pages` to `true` if named team members or author bio pages exist. Extract any explicitly mentioned credentials, certifications, or qualifications into `credentials_mentioned`. List legal page types found (e.g. `privacy_policy`, `terms`, `disclaimer`) in `legal_pages_present`. Extract any awards, certifications, or recognition into `awards_certifications`. Set `press_mentions_detected` to `true` if press coverage, media mentions, or "as seen in" sections exist. Use `null` for scalars and `[]` for arrays when not determinable.
- **aeo_readiness**: Assess the site's readiness for Answer Engine Optimization and AI-cited search. Set `entity_definition_clarity` to `clear` if the business/product is introduced with a clear one-sentence definition, `vague` if implied, `none` if absent. Set `faq_content_present` to `true` if any FAQ section or dedicated FAQ page exists. Score `structured_qa_patterns` as `strong` (multiple Q&A-rich pages), `partial` (some Q&A content), or `none` (no Q&A patterns). Extract any specific directory names, citation sources, or business listing services mentioned (e.g. Google Business Profile, Clutch, G2) into `directory_citation_mentions`. Set `original_data_or_research` to `true` if the site publishes original data, studies, surveys, or reports.
- **funnel_coverage**: Map the business's content to awareness/consideration/decision funnel stages. `tofu_present` = list of awareness-stage content types found (blog posts, how-to guides, industry insights, thought leadership). `tofu_missing` = obvious awareness content types absent. `mofu_present` = consideration-stage content found (case studies, comparisons, webinars, whitepapers, ROI calculators). `mofu_missing` = obvious consideration content absent. `bofu_present` = decision-stage content found (pricing pages, free trials, demos, testimonials). `bofu_missing` = obvious decision content absent. Use `[]` for any stage bucket when uncertain.
- **domain_authority**: If `pipeline_data.rawData.domainAuthority` is present and non-null, copy it verbatim into this field. If absent or null, set this field to `null`.

## Output Schema

```json
{
  "business_name": "string",
  "website": "string",
  "industry": "string",
  "primary_market": "string",
  "primary_services": ["string"],
  "icp": {
    "description": "string",
    "industries": ["string"],
    "pain_points": ["string"]
  },
  "brand_voice": "string",
  "positioning": "string",
  "competitors": [
    { "name": "string", "url": "string", "differentiator": "string", "type": "direct | indirect | aspirational", "content_strength": "weak | moderate | strong" }
  ],
  "social_media": [
    { "platform": "string", "url": "string", "source": "scraped | inferred" }
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
  "sitemap_urls": ["string"],
  "logo_url": "string | null",
  "analyst_notes": "string",
  "eeat_signals": {
    "about_page_quality": "thin | detailed | comprehensive",
    "team_or_author_pages": true,
    "credentials_mentioned": ["string"],
    "legal_pages_present": ["string"],
    "awards_certifications": ["string"],
    "press_mentions_detected": false
  },
  "aeo_readiness": {
    "entity_definition_clarity": "clear | vague | none",
    "faq_content_present": true,
    "structured_qa_patterns": "strong | partial | none",
    "directory_citation_mentions": ["string"],
    "original_data_or_research": false
  },
  "funnel_coverage": {
    "tofu_present": ["string"],
    "tofu_missing": ["string"],
    "mofu_present": ["string"],
    "mofu_missing": ["string"],
    "bofu_present": ["string"],
    "bofu_missing": ["string"]
  },
  "domain_authority": null
}
```

═══════════════════════════════════════════════════════════════════════════════
## QUALITY GATES
═══════════════════════════════════════════════════════════════════════════════

□ Every key in the schema is present (no missing keys)
□ No field contains invented information — everything traces to scraped content
□ Competitors array is empty [] if none are mentioned in the scraped content
□ primary_services contains only services/products actually described on the site
□ icp.pain_points reflect actual customer problems mentioned, not generic guesses
□ brand_voice is one of the allowed enum values
□ seo_signals.meta_quality is based on actual metadata in the scraped pages
□ analyst_notes mentions any significant data limitations
□ The output is valid JSON (no trailing commas, proper quoting)

═══════════════════════════════════════════════════════════════════════════════
## ERROR HANDLING
═══════════════════════════════════════════════════════════════════════════════

If <pipeline_data> is empty or missing:
→ Return the full schema with null/[] for all fields and explain in analyst_notes.

If only 1 page was scraped:
→ Proceed with analysis but note limited coverage in analyst_notes.

If scraped content is mostly navigation/boilerplate:
→ Extract what you can, use null for undeterminable fields, explain in analyst_notes.

If <additional_instructions> contains validator feedback:
→ Address each specific correction. Do NOT repeat the same error.
