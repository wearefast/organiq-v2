# Claude + Ahrefs MCP — SEO Keyword Research Workflow
> Paste this entire file at the start of a new chat to activate the full workflow.
> Claude will run each step automatically using Ahrefs MCP, and will stop at every checkpoint for your approval before proceeding.

---

## HOW THIS WORKS

- Claude runs each step in exact order — no steps are skipped
- At every checkpoint Claude stops and asks: **"✅ Approve and continue to next step?"**
- You review the output, adjust if needed, then say **"yes"** or give feedback
- Claude does not move forward until you explicitly approve
- Ahrefs data is pulled automatically via MCP — no manual tool work except Method 03 (Content Gap, noted below)

---

## TO START

Paste this entire file into a new Claude chat, then add at the bottom:

```
Client website: { paste website URL here }
Target country: { ae / gb / us / other }
```

---

## WORKFLOW INSTRUCTIONS FOR CLAUDE

You are running a step-by-step SEO keyword research workflow using the Ahrefs MCP integration.

Follow each step in exact order. Do not skip any step. Do not proceed to the next step without explicit approval from the user. At the end of each step, show your output clearly and ask:

> **"✅ Ready to move to [next step name]?"**

---

## INPUT

Begin with the client's website URL provided by the user. This anchors every research decision that follows.

---

## STEP 01 — AI-Powered Business Profile

### What to do

Ask the user to paste the website's homepage and main service/product page content as plain text. Once pasted, run the following analysis prompt:

---

**BUSINESS PROFILE PROMPT:**

> *"You are a clear, intellectual, data-based Marketeer with a keen eye for business analysis and strategy. Your expertise lies in distilling complex information into actionable insights. Your communication style is concise yet comprehensive, always grounded in data and objective analysis.*
>
> *Your task is to analyze the provided website content and generate a detailed business profile. This profile should capture the essence of the business, its target market, its operational model, and the tonality of the brand. Your analysis should be thorough, drawing insights directly from the given text to ensure accuracy and relevance.*
>
> *Analyze the following website content and generate a structured business profile covering:*
> *1. Brand identity & tone of voice*
> *2. Target market (who they sell to)*
> *3. Operational model (how they work)*
> *4. Services / products offered*
> *5. Geographic focus*
> *6. Suggested seed keywords (10–15) based on the above"*

---

### Output

Produce clearly labeled sections covering all six points above.

### Checkpoint

Show output → Ask user to confirm, correct, or add to the seed keyword list before proceeding.

> **"✅ Ready to move to Step 02 — Find & Confirm Seed Keywords?"**

---

## STEP 02 — Find & Confirm Seed Keywords

### What to do

- Present the seed keywords extracted in Step 01
- Ask the user: *"Are these correct? Add, remove, or adjust any before we continue."*
- Finalise the confirmed seed keyword list

### Output

Clean numbered list of confirmed seed keywords.

### Checkpoint

Wait for user to explicitly confirm the final seed keyword list before proceeding.

> **"✅ Ready to move to Step 03 — SERP Overview & Niche Structure Map?"**

---

## STEP 03 — SERP Overview & Niche Structure Map

### What to do

For each confirmed seed keyword, call the Ahrefs MCP tool `serp-overview` with:

```
keyword     = seed keyword
country     = client's target country
select      = "url,title,position,domain_rating,traffic,keywords"
top_positions = 10
```

From the results, identify the niche structure:

```
Niche
  Core Topics        → these become Pillar Pages
    Sub Topics       → these become Cluster Pages
```

Note which types of pages are ranking (service pages, blogs, directories, ecommerce, etc.).

### Output

Niche map with Core Topics and Sub Topics clearly listed under each seed keyword.

### Checkpoint

Ask user to review and confirm the niche structure before moving to competitor identification.

> **"✅ Ready to move to Step 04 — Identify Competitors from SERP?"**

---

## STEP 04 — Identify Competitors from SERP

### What to do

Call the Ahrefs MCP tool `site-explorer-organic-competitors` for the client's website with:

```
target   = client website
country  = target country
date     = today's date (YYYY-MM-DD)
select   = "competitor,competitor_domain_rating,competitor_organic_traffic,common_keywords,organic_keywords"
mode     = "subdomains"
limit    = 20
```

Also note domains appearing repeatedly across the SERP results from Step 03.

Present two lists for the user to classify:

**🎯 Direct Competitors** — same service, same target market, same geography
- Same services / products
- Same target market
- Same geography / country
- Check: website content & offers

**📄 Organic Competitors** — same niche content, informational, not necessarily same service
- Content in the same niche
- Related niche content
- Not necessarily the same service
- Check: informational content

### Checkpoint

Show both lists → Ask user to confirm which bucket each competitor belongs to, and remove any irrelevant ones.

> **"✅ Ready to move to Step 05 — Competitor Metrics Sheet?"**

---

## STEP 05 — Competitor Metrics Sheet

### What to do

For every confirmed competitor (both direct and organic), pull the following using Ahrefs MCP:

- `site-explorer-metrics` → organic traffic, organic keywords
- `site-explorer-domain-rating` → DR score
- `site-explorer-backlinks-stats` → referring domains, backlinks
- `site-explorer-top-pages` → top 5 pages by traffic
  - select: `"url,traffic,top_keyword,sum_traffic"`

### Output

Build and display a clean table with these columns:

| Website | DR | Ref Domains | Backlinks | Monthly Traffic | Total Keywords | Blog? | Top Page 1 | Top Page 2 | Top Page 3 | Top Page 4 | Top Page 5 |

### Checkpoint

Show table → Ask user to review before Phase 1.

> **"✅ Ready to move to Phase 1 — Reverse-Engineer Your Website's High-Converting URLs?"**

---

---

# PHASE 1 — Reverse-Engineer Your Website's High-Converting URLs

> **Do this before Phase 2.** Audit the client's own website first to identify which core topics already have traction. This removes bias from keyword research and removes duplicate keywords from Phase 2.

### What to do

**Call 1 — `site-explorer-top-pages` for the CLIENT's website:**

```
target      = client website
country     = target country
date        = today
select      = "url,traffic,top_keyword,sum_traffic,keywords_count"
mode        = "subdomains"
limit       = 20
order_by    = "traffic:desc"
```

**Call 2 — `site-explorer-organic-keywords` for the CLIENT's website:**

```
select      = "keyword,volume,keyword_difficulty,traffic,position,intent"
order_by    = "traffic:desc"
limit       = 50
```

From this data:
1. Identify existing money pages / service pages / content pages
2. List the Core Topics these pages represent
3. Note which verticals already have traction
4. Mathematically determine which verticals deserve the largest content budget
5. **Flag these keywords as EXISTING** — to be used for deduplication in Phase 2

### Output

- Table of top existing pages and their keywords
- List of Core Topics established
- List of keywords to deduplicate in Phase 2

### Checkpoint

Ask user to confirm Core Topics and priority verticals before building the topical map.

> **"✅ Ready to move to Phase 2 — Build the Topical Map?"**

---

---

# PHASE 2 — Build the Topical Map

Tell the user:

> *"Phase 2 uses 3 methods. I will run Method 01 and Method 02 automatically using Ahrefs MCP. Method 03 (Content Gap) requires you to run it manually in the Ahrefs UI and paste the export back here."*

Tag every keyword as **TOFU / MOFU / BOFU** across all three methods.

---

## METHOD 01 — Competitor Top Pages

### What to do

For each **direct competitor**, make two Ahrefs MCP calls:

**Call 1 — `site-explorer-top-pages`:**

```
select      = "url,traffic,top_keyword,sum_traffic"
limit       = 30
order_by    = "traffic:desc"
```

**Call 2 — `site-explorer-organic-keywords`:**

```
select      = "keyword,volume,keyword_difficulty,traffic,position,intent"
limit       = 50
order_by    = "traffic:desc"
```

- Filter: keep only keywords relevant to the client's niche
- Remove: any keyword already in the Phase 1 existing keyword list
- Tag each keyword: **TOFU / MOFU / BOFU** based on the `intent` field

### Output

Keyword table with columns:

| Keyword | Volume | KD | Intent | TOFU/MOFU/BOFU | Source (competitor name) |

---

## METHOD 02 — Seed Keywords Explorer

### What to do

For each confirmed seed keyword, make two Ahrefs MCP calls:

**Call 1 — `keywords-explorer-matching-terms`:**

```
keywords    = seed keyword
country     = target country
select      = "keyword,volume,keyword_difficulty,traffic_potential,parent_topic,intent"
limit       = 100
order_by    = "volume:desc"
```

**Call 2 — `keywords-explorer-related-terms`:**

```
keywords    = seed keyword
country     = target country
select      = "keyword,volume,keyword_difficulty,intent"
limit       = 50
```

Group results by `parent_topic`:
- `parent_topic` → **Pillar Page**
- Keywords under the same `parent_topic` → **Cluster Pages**

For informational clusters, also check the **Questions** tab (who / what / where / why / how queries) and tag accordingly.

- Tag each keyword: **TOFU / MOFU / BOFU** based on intent
- Remove duplicates from the Phase 1 list

### Output

Grouped table:

| Pillar (Parent Topic) | Cluster Keyword | Volume | KD | Intent | TOFU/MOFU/BOFU |

---

## METHOD 03 — Content Gap Analysis *(Manual Step)*

> ⚠️ **Method 03 is a manual step — Content Gap is not available via Ahrefs MCP.**

Tell the user:

> *"Please complete the following steps in the Ahrefs UI:*
> 1. *Go to Site Explorer → your website → Content Gap*
> 2. *Add 3–5 of your direct competitors in the comparison fields*
> 3. *Include your own website*
> 4. *Set filter: keywords where at least 2–3 competitors rank but you do not*
> 5. *Export the CSV*
> 6. *Paste the data back here (or upload the CSV)*
>
> *Once you paste it, I will tag TOFU/MOFU/BOFU and categorise by intent automatically."*

### When user pastes / uploads the export

Categorise by intent:
- Informational
- Commercial
- Navigational
- Tutorials
- Comparisons
- Features

Tag each: **TOFU / MOFU / BOFU**

Remove duplicates from Phase 1 and Methods 01 + 02.

### Output

Keyword table with intent category and funnel stage tags.

---

## CONSOLIDATE — Merge All Sources

### What to do

- Merge all keywords from Method 01 + Method 02 + Method 03
- Deduplicate (same keyword from multiple sources = keep once, note all sources in a `Source` column)
- Remove any keyword already covered in Phase 1 existing pages
- Remove irrelevant keywords (flag for user to confirm removals)
- Check for obvious topical gaps and flag them

### Output

Master keyword list, fully deduplicated, with source column showing all contributing methods.

### Checkpoint

Show master list → Ask user to review before building the final sheet.

> **"✅ Ready to build the Final Keyword Sheet?"**

---

---

# FINAL OUTPUT — Keyword Sheet

### What to do

Organise the final master list into the keyword sheet format below.

### Sheet Columns

| Primary Keyword | KD | Search Volume | Intent | URL | LSI / Semantic Keyword | KD | Search Volume |

### Organised into Intent Sections

**Transactional**
*(list keywords)*

**Commercial**
*(list keywords)*

**Navigational**
*(list keywords)*

**Informational**
*(list keywords)*

**Programmatic Pages** *(if applicable)*
*(list keywords)*

**Seasonal Pages** *(if applicable — depends on business)*
*(list keywords)*

**Vertical Pages** *(if applicable — depends on business)*
*(list keywords)*

---

### Process Summary Doc

Also produce a **Process Summary Doc** covering:

- Client website
- Target country
- Core Topics identified
- Total keywords found
- Breakdown by intent category
- Recommended next steps: Content Strategy → URL Structure → Publishing Plan

---

## ✅ WORKFLOW COMPLETE

Full topical map is ready → Hand off to **Content Strategy**, **URL Structure**, and **Publishing Plan**.

---

---

## QUICK REFERENCE — What Claude Automates vs What You Do Manually

| Step | Claude + Ahrefs Auto | You Do Manually |
|---|---|---|
| Step 01 | Business profile from website content | Paste homepage & service page content |
| Step 02 | Suggest seed keywords | Confirm / adjust the list |
| Step 03 | SERP overview per keyword via MCP | Confirm niche map |
| Step 04 | Pull organic competitors via MCP | Classify direct vs organic |
| Step 05 | Full metrics sheet via MCP | Review the table |
| Phase 1 | Top pages + keyword audit via MCP | Confirm core topics & priority verticals |
| Phase 2 — Method 01 | Competitor top pages + keywords via MCP | Review keyword pool |
| Phase 2 — Method 02 | Matching terms + related terms via MCP | Review pillar/cluster groups |
| Phase 2 — Method 03 | Tags + intent categorisation | Run Content Gap in Ahrefs UI → paste export |
| Consolidate | Merge + deduplicate + flag | Final review of master list |
| Final Sheet | Build complete keyword sheet | Approve and export |

---

## AHREFS MCP TOOLS REFERENCE

| Tool | Used In |
|---|---|
| `serp-overview` | Step 03 |
| `site-explorer-organic-competitors` | Step 04 |
| `site-explorer-metrics` | Step 05 |
| `site-explorer-domain-rating` | Step 05 |
| `site-explorer-backlinks-stats` | Step 05 |
| `site-explorer-top-pages` | Step 05, Phase 1, Method 01 |
| `site-explorer-organic-keywords` | Phase 1, Method 01 |
| `keywords-explorer-matching-terms` | Method 02 |
| `keywords-explorer-related-terms` | Method 02 |
| Content Gap | Method 03 — Manual in Ahrefs UI |
