export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  body: string;
  tags: string[];
  estimatedReadTime: number; // minutes
}

export interface HelpCategory {
  id: string;
  title: string;
  slug: string;
  icon: string; // lucide icon name
  description: string;
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  // ─── 1. Getting Started ────────────────────────────────────────────────────
  {
    id: 'getting-started',
    title: 'Getting Started',
    slug: 'getting-started',
    icon: 'Rocket',
    description: 'Learn the basics — set up your workspace, create your first project, and run your first workflow.',
    articles: [
      {
        id: 'what-is-organiq',
        title: 'What is Organiq?',
        slug: 'what-is-organiq',
        tags: ['intro', 'overview', 'platform'],
        estimatedReadTime: 3,
        body: `## What is Organiq?

Organiq is an **agent-led SEO/GEO/AEO strategy platform** that automates the entire content strategy lifecycle. Instead of manually switching between dozens of tools, Organiq orchestrates a multi-phase AI pipeline that:

1. **Audits your site** — technical SEO, Core Web Vitals, AI bot indexability
2. **Researches keywords** — competitive gaps, intent mapping, funnel stages
3. **Builds a topical map** — pillars, clusters, publishing calendar
4. **Generates content** — briefs for writers, full articles, and images

All outputs are human-reviewable. Every AI step requires your approval before downstream steps proceed.

### Who is it for?

- **SEO agencies** managing multiple client sites
- **In-house SEO teams** scaling content production
- **Content marketers** who need data-driven briefs fast

### How does it work at a high level?

\`\`\`
Create Workspace → Create Project → Start Workflow Run
  → Phase 1: Site Intelligence (8 steps)
  → Phase 2: Keyword Research (5 steps)
  → Phase 3: Strategy (2 steps)
  → Phase 4: Content Generation (3 steps)
→ Download Reports / Export Content
\`\`\`

Every step produces structured output you can approve, request revisions on, or reject.`,
      },
      {
        id: 'create-workspace',
        title: 'Create your first workspace',
        slug: 'create-workspace',
        tags: ['workspace', 'setup', 'onboarding'],
        estimatedReadTime: 2,
        body: `## Creating your first workspace

A **workspace** represents a client account or a business unit. Everything you do — projects, reports, content — lives inside a workspace.

### Steps

1. After signing in, you'll land on the **Workspaces** page
2. Click **"New Workspace"** in the top-right corner
3. Enter:
   - **Name** — e.g., "Acme Corp" or "My Agency"
   - **Slug** — auto-generated from the name (URL-safe)
4. Click **Create** — you'll be redirected to the workspace's project list

### What is the difference between a workspace and a project?

| | Workspace | Project |
|---|---|---|
| Represents | A client / business unit | A single domain / market |
| Contains | Projects | Workflows, keywords, content |
| Billing | Shared credit pool | Credits deducted per run |

You can have **multiple projects** inside one workspace — useful when a client has multiple domains or regional variants.`,
      },
      {
        id: 'create-project',
        title: 'Create a project',
        slug: 'create-project',
        tags: ['project', 'setup', 'domain'],
        estimatedReadTime: 2,
        body: `## Creating a project

A **project** is tied to a single domain and market (country + language). All workflow runs, keywords, topical maps, and content pieces are scoped to one project.

### Steps

1. Inside your workspace, click **"New Project"**
2. Fill in:
   - **Name** — descriptive name (e.g., "US Market - Blog")
   - **Domain** — the target domain (e.g., \`example.com\`)
   - **Country** — defaults to US; pick the target market
   - **Language** — defaults to English
   - **Industry** — optional, helps AI agents tailor recommendations
3. Click **Create Project**

### Tips

- Use one project **per domain per market** — don't mix US and UK traffic in one project
- The domain is used for Ahrefs backlink lookups, Firecrawl scraping, and PageSpeed analysis — enter it without \`https://\` (e.g., \`example.com\`)
- You can edit project settings later from the project's **Settings** tab`,
      },
      {
        id: 'start-workflow',
        title: 'Start your first workflow run',
        slug: 'start-workflow',
        tags: ['workflow', 'run', 'start'],
        estimatedReadTime: 3,
        body: `## Starting your first workflow run

Once you have a project, you can kick off the 18-step AI workflow.

### Prerequisites

- Your organization must have enough credits (a full run costs ~740 credits)
- The project must have a valid domain configured

### Steps

1. Navigate to your project → click **Workflows** in the sidebar
2. Click **"Start New Run"**
3. The system will:
   - Create 18 pending workflow steps
   - Immediately enqueue Phase 1 steps in parallel
4. You'll see the step rail update in real time as agents run

### What happens next?

- Phase 1 agents start immediately and run in parallel
- As each step finishes, it shows in \`awaiting_approval\` state
- You **review and approve** each step before downstream steps unlock
- The full run takes approximately **90–120 minutes**

### Credit note

Credits are **only deducted when a step completes successfully**. If a step fails, no credits are charged. You can check your balance at any time via **Billing** in the sidebar.`,
      },
    ],
  },

  // ─── 2. The AI Workflow ────────────────────────────────────────────────────
  {
    id: 'workflow',
    title: 'The AI Workflow',
    slug: 'workflow',
    icon: 'Workflow',
    description: 'Deep-dive into the 18-step AI pipeline — how it works, what each phase does, and how to review outputs.',
    articles: [
      {
        id: 'workflow-overview',
        title: 'Workflow overview',
        slug: 'workflow-overview',
        tags: ['workflow', 'pipeline', 'overview', 'phases'],
        estimatedReadTime: 5,
        body: `## Workflow overview

The Organiq workflow is an **18-step directed AI pipeline** split into 4 phases. Each step is an independent agent that uses external tools (Ahrefs, DataForSEO, Firecrawl, PageSpeed, etc.) and a large language model to produce structured output.

### The 4 phases

| Phase | Steps | Purpose | Approx. Time | Credits |
|-------|-------|---------|--------------|---------|
| Phase 1 | 1–8 | Site intelligence & competitor analysis | 30–60 min | 365 |
| Phase 2 | 9–13 | Keyword discovery & consolidation | 20–40 min | 220 |
| Phase 3 | 14–15 | Strategy synthesis & topical map | 10–15 min | 75 |
| Phase 4 | 16–18 | Content generation (per unit) | 5–10 min | 80+ |

### Phase 1 — Intelligence & Audit

| # | Agent | Purpose |
|---|-------|---------|
| 1 | business-profile | Homepage scrape + backlink analysis |
| 2 | seed-keywords | Initial keyword discovery |
| 3 | site-audit | GEO + technical SEO audit |
| 4 | ai-intelligence | AI search brand radar + competitor mentions |
| 5 | serp-niche-map | SERP landscape mapping |
| 6 | competitor-buckets | Competitor identification |
| 7 | competitor-metrics | Traffic, KD, and content gaps analysis |
| 8 | search-demand | Volume + seasonality mapping |

### Phase 2 — Keyword Research

| # | Agent | Purpose |
|---|-------|---------|
| 9 | phase1-baseline | Client organic keyword consolidation |
| 10 | method01-competitor-pages | Keywords from competitor pages |
| 11 | method02-seed-expansion | Expand with related terms |
| 12 | method03-content-gap-import | Manual content gap import |
| 13 | consolidated-keywords | Merge all sources into final taxonomy |

### Phase 3 — Strategy & Planning

| # | Agent | Purpose |
|---|-------|---------|
| 14 | verdict-strategy | Final strategy verdict + roadmap |
| 15 | topical-map | Hierarchical pillar/cluster map + calendar |

### Phase 4 — Content Production

| # | Agent | Purpose |
|---|-------|---------|
| 16 | content-brief | SEO-optimized brief for writers |
| 17 | content-article | Full article generation + scoring |
| 18 | content-images | Image suggestions and assets |

Steps within each phase can run **in parallel** where their dependencies are met. Dependency resolution uses Kahn's topological sort — you don't need to manage this manually.`,
      },
      {
        id: 'step-states',
        title: 'Understanding step states',
        slug: 'step-states',
        tags: ['workflow', 'steps', 'states', 'approval'],
        estimatedReadTime: 3,
        body: `## Understanding step states

Every workflow step moves through a series of states. Here's what each one means:

### State lifecycle

\`\`\`
pending → running → completed → awaiting_approval
                                      ↓
                              approved (unlocks downstream)
                                      OR
                              revision_requested (re-runs with notes)
                                      OR
                              rejected (step terminates)
\`\`\`

### State descriptions

| State | What it means |
|-------|--------------|
| \`pending\` | Waiting for dependencies to complete |
| \`running\` | Agent is actively executing |
| \`completed\` | Step finished; output stored |
| \`awaiting_approval\` | Waiting for your review |
| \`approved\` | You approved; downstream steps can unlock |
| \`revision_requested\` | You requested changes; agent will re-run |
| \`rejected\` | Step rejected; no downstream steps will run |
| \`failed\` | System error; retry is attempted automatically |
| \`skipped\` | Step was bypassed (e.g., no applicable data) |

### Approving a step

1. Click on a step in the step rail
2. Review the **artifact panel** (structured output)
3. Optionally view the **reasoning panel** (agent's reasoning process)
4. Click **Approve**, **Request Revision**, or **Reject**
5. For revisions, add notes explaining what to change

### Important notes

- You **must approve** a step before downstream steps can run
- Requesting a revision re-runs the agent — this **consumes credits again**
- Rejecting a step **stops all downstream steps** that depend on it`,
      },
      {
        id: 'real-time-updates',
        title: 'Real-time progress updates',
        slug: 'real-time-updates',
        tags: ['workflow', 'real-time', 'websocket', 'progress'],
        estimatedReadTime: 2,
        body: `## Real-time progress updates

The workflow page updates in real time using WebSockets. You don't need to refresh the page.

### What updates in real time

- **Step rail** — each step's status indicator (spinning = running, green = completed, orange = awaiting review)
- **Progress bar** — overall workflow completion percentage
- **Artifact panel** — the step output appears as soon as the agent finishes
- **Tool call trail** — live log of every external API call the agent makes

### If updates stop appearing

This can happen if your browser connection drops. Simply refresh the page — your workflow is still running in the background and will continue uninterrupted.

### Notifications

When a step reaches \`awaiting_approval\`, you'll receive an in-app notification (bell icon in the top bar). Click it to jump directly to that step's review panel.`,
      },
    ],
  },

  // ─── 3. Phase Timings & Credits ───────────────────────────────────────────
  {
    id: 'timings-credits',
    title: 'Timings & Credits',
    slug: 'timings-credits',
    icon: 'Clock',
    description: 'How long each phase takes and exactly how many credits are consumed per step.',
    articles: [
      {
        id: 'how-long-does-a-run-take',
        title: 'How long does a full run take?',
        slug: 'how-long-does-a-run-take',
        tags: ['timing', 'duration', 'run', 'phases'],
        estimatedReadTime: 3,
        body: `## How long does a full run take?

A complete 18-step workflow run takes approximately **90–120 minutes** from start to finish.

### Phase-by-phase breakdown

| Phase | Steps | Duration | What affects timing |
|-------|-------|----------|-------------------|
| Phase 1 | 8 steps | 30–60 min | Ahrefs/DataForSEO API latency; Firecrawl crawl depth |
| Phase 2 | 5 steps | 20–40 min | Keyword volume; DataForSEO batch sizes |
| Phase 3 | 2 steps | 10–15 min | LLM reasoning time; Claude extended thinking |
| Phase 4 | 3 steps (per unit) | 5–10 min | Article length; image generation queue |

### Factors that can increase timing

- **API rate limits** — Ahrefs allows ~60 req/min; Serper and DataForSEO are batched to stay within limits
- **Site size** — Firecrawl crawls up to 20 pages; larger sites with more redirects take longer
- **Revision cycles** — Requesting a revision re-runs an agent, adding to total time

### Tips to speed things up

- Pre-approve earlier steps as they complete rather than waiting for all of Phase 1 to finish
- If a step fails and retries, it will automatically retry up to 3 times with exponential backoff

### Content generation (Phase 4)

Phase 4 runs **per content unit**. If your topical map has 10 articles, Phase 4 runs 10 × 3 steps. Each unit takes 5–10 minutes.`,
      },
      {
        id: 'credit-costs',
        title: 'Credit costs per step',
        slug: 'credit-costs',
        tags: ['credits', 'cost', 'billing', 'per step'],
        estimatedReadTime: 3,
        body: `## Credit costs per step

Credits are the currency of Organiq. Each workflow step has a fixed credit cost. Credits are **only deducted when a step completes successfully** — failed steps are not charged.

### Full cost breakdown

| Phase | Agent | Credits |
|-------|-------|---------|
| **Phase 1** | business-profile | 30 |
| | seed-keywords | 40 |
| | site-audit | 60 |
| | ai-intelligence | 50 |
| | serp-niche-map | 45 |
| | competitor-buckets | 35 |
| | competitor-metrics | 55 |
| | search-demand | 50 |
| **Phase 1 Total** | | **365** |
| **Phase 2** | phase1-baseline | 45 |
| | method01-competitor-pages | 55 |
| | method02-seed-expansion | 50 |
| | method03-content-gap-import | 30 |
| | consolidated-keywords | 40 |
| **Phase 2 Total** | | **220** |
| **Phase 3** | verdict-strategy | 35 |
| | topical-map | 40 |
| **Phase 3 Total** | | **75** |
| **Phase 4 (per unit)** | content-brief | 25 |
| | content-article | 30 |
| | content-images | 25 |
| **Phase 4 Per Unit** | | **80** |

### Total for a standard run

- Phases 1–3: **660 credits**
- Phase 4 × 1 content unit: **80 credits**
- **Full run estimate: ~740 credits**

### On-demand agents

On-demand agents cost 3–5 credits per run and only charge on success.

### Viewing your balance

Go to **Billing** in the sidebar to see your current balance, transaction history, and to purchase additional credits.`,
      },
    ],
  },

  // ─── 4. Keywords ──────────────────────────────────────────────────────────
  {
    id: 'keywords',
    title: 'Keywords',
    slug: 'keywords',
    icon: 'Tag',
    description: 'Keyword discovery, lifecycle management, intent types, and funnel stage classification.',
    articles: [
      {
        id: 'keyword-lifecycle',
        title: 'Keyword lifecycle',
        slug: 'keyword-lifecycle',
        tags: ['keywords', 'lifecycle', 'status', 'workflow'],
        estimatedReadTime: 3,
        body: `## Keyword lifecycle

Keywords in Organiq move through a defined lifecycle from discovery to publication.

### Status progression

\`\`\`
discovered → approved → brief_ready → written → published
\`\`\`

| Status | Meaning |
|--------|---------|
| \`discovered\` | Found by a workflow agent; pending your review |
| \`approved\` | You've confirmed this keyword is worth targeting |
| \`brief_ready\` | A content brief has been generated for this keyword |
| \`written\` | An article is written (draft or review stage) |
| \`published\` | Content is live on your site |

### How keywords are discovered

Keywords enter the system automatically from multiple workflow steps:

- **seed-keywords** (Step 2) — initial keyword set from Ahrefs organic data
- **method01-competitor-pages** (Step 10) — keywords from competitor top pages
- **method02-seed-expansion** (Step 11) — related queries from DataForSEO
- **method03-content-gap-import** (Step 12) — manual imports of content gap data
- **consolidated-keywords** (Step 13) — merged, deduplicated final set

### Approving keywords

1. Go to your project → **Keywords** in the sidebar
2. Filter by \`discovered\` status
3. Review volume, difficulty, intent, and funnel stage
4. Check the checkbox next to keywords you want → click **Approve**

Approved keywords become the input for your topical map and content pipeline.`,
      },
      {
        id: 'keyword-intent',
        title: 'Keyword intent types',
        slug: 'keyword-intent',
        tags: ['keywords', 'intent', 'transactional', 'commercial', 'informational', 'navigational'],
        estimatedReadTime: 2,
        body: `## Keyword intent types

Organiq classifies every keyword into one of four intent categories based on what the user is trying to accomplish.

### Intent categories

| Intent | What the user wants | Example |
|--------|--------------------|---------| 
| **Transactional** | To buy or complete an action | "buy running shoes online" |
| **Commercial** | To research before buying | "best running shoes 2026" |
| **Informational** | To learn about a topic | "how to choose running shoes" |
| **Navigational** | To find a specific site/page | "Nike running shoes website" |

### Why intent matters

- **Transactional + commercial** keywords → product and landing pages, high conversion potential
- **Informational** keywords → blog posts, guides, and topical authority content
- **Navigational** keywords → often competitor brand terms; useful for gap analysis

### Filtering by intent

On the Keywords page, use the **Intent** filter to view keywords by category. Use this to:

- Find all commercial-intent keywords for your top-of-funnel vs. bottom-of-funnel content planning
- Identify informational gaps where competitors rank but you don't`,
      },
      {
        id: 'funnel-stages',
        title: 'Funnel stages (TOFU / MOFU / BOFU)',
        slug: 'funnel-stages',
        tags: ['keywords', 'funnel', 'tofu', 'mofu', 'bofu'],
        estimatedReadTime: 2,
        body: `## Funnel stages

Beyond intent, Organiq maps keywords to funnel stages to help you plan a complete content strategy.

### The three stages

| Stage | Full name | What content fits here |
|-------|-----------|----------------------|
| **TOFU** | Top of Funnel | Awareness content — broad educational articles, guides |
| **MOFU** | Middle of Funnel | Consideration content — comparisons, case studies, reviews |
| **BOFU** | Bottom of Funnel | Decision content — product pages, pricing, demos, trials |

### Reading the funnel in Organiq

On the Keywords page, each keyword shows a funnel badge:
- 🔵 **TOFU** — high volume, lower conversion intent
- 🟡 **MOFU** — medium volume, comparison intent
- 🟢 **BOFU** — lower volume, high purchase intent

### Using funnel stages in your topical map

When your topical map is generated (Step 15), it uses funnel stages to balance the content calendar across awareness, consideration, and decision content. You'll see this distribution in the calendar view.`,
      },
    ],
  },

  // ─── 5. Topical Maps ──────────────────────────────────────────────────────
  {
    id: 'topical-maps',
    title: 'Topical Maps',
    slug: 'topical-maps',
    icon: 'Map',
    description: 'Understand the pillar-cluster structure and how to use your topical map for content planning.',
    articles: [
      {
        id: 'what-is-a-topical-map',
        title: 'What is a topical map?',
        slug: 'what-is-a-topical-map',
        tags: ['topical map', 'pillars', 'clusters', 'content planning'],
        estimatedReadTime: 3,
        body: `## What is a topical map?

A topical map is a **hierarchical content structure** that organizes all your target keywords into pillars (main topics) and clusters (subtopics). It's the output of Step 15 (topical-map agent) and forms the blueprint for your content strategy.

### Structure

\`\`\`
Topical Map
├── Pillar 1: Running Shoes
│   ├── Cluster: Best Running Shoes
│   │   ├── "best running shoes for men 2026"
│   │   └── "best trail running shoes"
│   └── Cluster: Running Shoe Technology
│       ├── "carbon plate running shoes"
│       └── "how does foam cushioning work"
└── Pillar 2: Marathon Training
    └── Cluster: Training Plans
        └── "16-week marathon training plan"
\`\`\`

### Pillars

A **pillar** is a broad topic that encompasses a significant segment of your audience's interests. Each pillar typically corresponds to a major section of your site.

### Clusters

A **cluster** is a group of closely related keywords within a pillar. Each cluster usually maps to one piece of content (a "cluster page") and several supporting articles.

### Content calendar

The topical map includes an optional **content calendar** — a recommended publishing schedule that balances pillar coverage and funnel stages over time.

### Navigating the map

On the Topical Map page:
1. See all pillars as expandable cards
2. Click a pillar to reveal its clusters
3. Click a cluster to see its keywords and funnel stage distribution
4. Export the map to include in your strategy report`,
      },
    ],
  },

  // ─── 6. Content ───────────────────────────────────────────────────────────
  {
    id: 'content',
    title: 'Content',
    slug: 'content',
    icon: 'FileText',
    description: 'Briefs, articles, quality scores, and the full content lifecycle from draft to published.',
    articles: [
      {
        id: 'briefs-vs-articles',
        title: 'Briefs vs. articles',
        slug: 'briefs-vs-articles',
        tags: ['content', 'brief', 'article', 'types'],
        estimatedReadTime: 2,
        body: `## Briefs vs. articles

Organiq produces two types of content pieces:

### Briefs (Step 16)

A **brief** is a structured document for a human writer or further AI generation. It contains:

- Target keyword + supporting keywords
- Recommended word count
- Outline with H2/H3 structure
- Talking points with supporting data
- E-E-A-T signals (expertise, experience, authoritativeness, trustworthiness)
- Competing content analysis (what ranks today and why)

Briefs go through: **draft → review → approved**

### Articles (Step 17)

An **article** is a fully written piece in markdown format. It includes:

- Complete article body with all sections
- Meta title and meta description
- Internal linking suggestions
- CTAs (calls to action)
- Quality scores (readability, SEO, AI citability)

Articles go through: **draft → review → approved → published**

### The handoff

Step 17 (content-article) always runs after its corresponding Step 16 brief is approved. The brief data is fed directly into the article agent — you approve the brief, then the article generates automatically.`,
      },
      {
        id: 'content-scores',
        title: 'Content quality scores',
        slug: 'content-scores',
        tags: ['content', 'scores', 'quality', 'seo', 'readability'],
        estimatedReadTime: 2,
        body: `## Content quality scores

Every generated article is scored across four dimensions (0–100 each).

### Score breakdown

| Score | What it measures |
|-------|-----------------|
| **Readability** | Flesch-Kincaid grade level, sentence complexity, passive voice ratio |
| **SEO quality** | Keyword density, title tag optimization, heading structure, internal link targets |
| **AI citability** | Factual accuracy signals, structured data quality, E-E-A-T markers, citation-worthy structure |
| **Content length** | Word count vs. target; penalized if too short or padded |

### Score thresholds

| Range | Rating |
|-------|--------|
| 90–100 | Excellent |
| 75–89 | Good |
| 60–74 | Fair |
| 45–59 | Poor |
| 0–44 | Critical |

### Why AI citability matters

With the rise of AI-generated search responses (Google AI Overviews, Perplexity, ChatGPT Search), content that scores high on AI citability is more likely to be referenced in AI answers — driving "dark traffic" and brand visibility beyond traditional SEO.

### Improving scores

Request a revision on a low-scoring article and include notes like:
- "Improve readability — simplify long sentences in the introduction"
- "Add more factual statistics with citations to improve AI citability"
- "Increase internal linking — add 3 links to related cluster pages"`,
      },
    ],
  },

  // ─── 7. Reports ───────────────────────────────────────────────────────────
  {
    id: 'reports',
    title: 'Reports',
    slug: 'reports',
    icon: 'BarChart2',
    description: 'Generate, download, and share PDF strategy reports from your workflow data.',
    articles: [
      {
        id: 'report-types',
        title: 'Report types',
        slug: 'report-types',
        tags: ['reports', 'pdf', 'types', 'export'],
        estimatedReadTime: 2,
        body: `## Report types

Organiq generates four types of downloadable PDF reports from your completed workflow data.

| Report | Contents |
|--------|---------|
| **Full Strategy** | Comprehensive SEO strategy with roadmap, quick wins, long-term priorities |
| **AI Visibility** | GEO/AEO opportunity analysis and optimization recommendations for AI search engines |
| **Keyword Research** | Summary with scoring, intent distribution, funnel mapping, and difficulty tiers |
| **Content Plan** | Content calendar, topical structure, publishing schedule, and resource estimates |

### When to use each report

- **Full Strategy** — present to stakeholders at the start of an engagement
- **AI Visibility** — focus quarterly review on brand visibility in AI engines
- **Keyword Research** — detailed handoff to SEO specialist or writer team
- **Content Plan** — editorial calendar planning with your content team`,
      },
      {
        id: 'generate-report',
        title: 'How to generate and download a report',
        slug: 'generate-report',
        tags: ['reports', 'generate', 'download', 'pdf'],
        estimatedReadTime: 2,
        body: `## Generating and downloading a report

### Prerequisites

- The workflow run must have completed Phases 1–3 at minimum
- You must have approved the relevant upstream steps

### Steps

1. Navigate to your project → click **Reports** in the sidebar
2. Click **"Generate Report"**
3. Select the **report type** from the dropdown
4. Click **Generate** — this takes 5–15 seconds
5. Once generated, click **Download** to save the PDF to your computer

### What's inside a generated report

Each report is populated with data from your workflow's step artifacts:
- Real keyword data from your Ahrefs/DataForSEO pulls
- Actual competitor analysis from your workflow
- Site audit findings from Firecrawl + PageSpeed
- Strategy recommendations from the verdict-strategy agent

### Sharing reports

Reports are downloaded as standard PDF files — share them via email, Slack, or your client portal. The PDF includes your project's domain and generation date in the footer.`,
      },
    ],
  },

  // ─── 8. On-Demand Agents ─────────────────────────────────────────────────
  {
    id: 'on-demand-agents',
    title: 'On-Demand Agents',
    slug: 'on-demand-agents',
    icon: 'Bot',
    description: 'Ad-hoc AI agents for instant analysis — ask questions, get recommendations in seconds.',
    articles: [
      {
        id: 'agent-types',
        title: 'Available agent types',
        slug: 'agent-types',
        tags: ['agents', 'on-demand', 'types', 'chat'],
        estimatedReadTime: 3,
        body: `## Available on-demand agents

On-demand agents let you ask targeted questions about your project data without running a full 18-step workflow. Each agent runs in 5–30 seconds and costs 3–5 credits.

### Agent directory

| Agent | Purpose | Credits |
|-------|---------|---------|
| **Content Refresh** | Identifies declining pages using GSC data + keyword decay signals | 5 |
| **AI Search Visibility** | Analyzes LLM traffic patterns and prompt visibility gaps | 5 |
| **Technical Issues** | Summarizes LLM audit findings and flags critical indexability issues | 3 |
| **Keyword Opportunity** | Finds high-impression, low-CTR keywords — your "quick win" list | 5 |
| **Google vs. AI** | Compares your Google Search traffic vs. LLM-referred traffic | 4 |
| **Keyword Decay** | Alerts on keywords where your position or volume is dropping | 3 |
| **Competitor Analysis** | Analyzes competitor AI citations and contested keyword overlaps | 5 |

### How to use an on-demand agent

1. Navigate to your project → **Agents** in the sidebar
2. Type a natural language question in the chat input
   - e.g., "What keywords are we losing visibility on?"
   - e.g., "Which pages should we refresh this month?"
3. The system classifies your intent and routes to the best-fit agent
4. Results appear in seconds with structured recommendations and data citations

### Tips for better results

- Be specific: "Show me informational keywords with high impressions but under 2% CTR" outperforms "show me keywords"
- Include context: "For our running shoes blog, which competitor is gaining the most AI mentions?"
- Agents use your live project data — GSC connections, keyword decay history, and LLM traffic sessions`,
      },
    ],
  },

  // ─── 9. AI Search & LLM Features ─────────────────────────────────────────
  {
    id: 'ai-search',
    title: 'AI Search & LLM Features',
    slug: 'ai-search',
    icon: 'Eye',
    description: 'LLM Audit, Prompt Visibility tracking, and LLM Traffic analytics — visibility in the AI era.',
    articles: [
      {
        id: 'llm-audit',
        title: 'LLM Crawlability Audit',
        slug: 'llm-audit',
        tags: ['llm', 'audit', 'ai', 'indexability', 'crawlability'],
        estimatedReadTime: 3,
        body: `## LLM Crawlability Audit

The **LLM Crawlability Audit** checks your site pages for AI bot indexability. AI search engines (ChatGPT, Perplexity, Bing Copilot, Claude) use their own crawlers to index content — and they have different requirements than Google.

### What the audit checks

For each page crawled:

| Check | What it looks for |
|-------|--------------------|
| **AI Indexability Score** | Overall 0–100 score based on all checks |
| **Robot permissions** | Are \`robots.txt\` and \`<meta robots>\` allowing AI crawlers? |
| **Content structure** | Are headings, lists, and tables used clearly? |
| **Trust signals** | Author information, publication dates, citations |
| **Content chunking** | Is content broken into digestible sections for LLM context windows? |

### Running the audit

1. Navigate to your project → **AI Search** → **LLM Audit** in the sidebar
2. Click **"Run Audit"**
3. The system crawls up to 20 pages of your site
4. Results appear page-by-page with issue lists and severity ratings

### Interpreting results

- **Score 80+** — Well-optimized for AI crawlers
- **Score 60–79** — Some improvements recommended
- **Score below 60** — Significant barriers to AI indexing

### Common issues found

- \`CCBot\` or \`GPTBot\` blocked in \`robots.txt\`
- No structured author data (hurts E-E-A-T trust signals)
- Very long paragraphs with no headers (hard for LLMs to chunk)
- Missing meta descriptions (used by AI engines for content summaries)`,
      },
      {
        id: 'prompt-visibility',
        title: 'Prompt Visibility',
        slug: 'prompt-visibility',
        tags: ['prompt visibility', 'brand', 'llm', 'ai mentions'],
        estimatedReadTime: 3,
        body: `## Prompt Visibility

**Prompt Visibility** monitors how often and how well your brand is mentioned in responses from AI search engines like ChatGPT, Perplexity, Bing Copilot, and Claude.

### How it works

1. You configure tracked prompts — search queries that your target audience would type into AI engines
   - e.g., "What is the best CRM for small businesses?"
   - e.g., "Who makes the best trail running shoes?"
2. Organiq periodically sends these prompts to AI engines and captures the responses
3. It scores each response for your brand's presence, position, and sentiment

### What's tracked

| Metric | Description |
|--------|-------------|
| **Mention rate** | % of responses that mention your brand |
| **Position** | Whether your brand is mentioned 1st, 2nd, etc. |
| **Sentiment** | Positive, neutral, or negative framing |
| **Competitor presence** | Which competitors are mentioned in the same responses |

### Improving prompt visibility

- Use the LLM Audit to fix indexability issues
- Publish authoritative content on the topics your tracked prompts cover
- Add structured data (FAQ schema, HowTo schema) to key pages
- Build citations from authoritative sources that AI engines trust`,
      },
      {
        id: 'llm-traffic',
        title: 'LLM Traffic Analytics',
        slug: 'llm-traffic',
        tags: ['llm traffic', 'analytics', 'ai referral', 'dark traffic'],
        estimatedReadTime: 2,
        body: `## LLM Traffic Analytics

**LLM Traffic Analytics** tracks visitors who arrive at your site after interacting with an AI engine. This "dark traffic" was previously invisible in analytics tools.

### What is LLM traffic?

When a user asks ChatGPT, Perplexity, or another AI engine a question, the AI may recommend your site. That user then clicks through to your site. Traditional analytics often misattributes this as "direct" traffic.

Organiq's tracker identifies these sessions by:
- Detecting referrer patterns from AI engines
- Identifying session characteristics common to AI-referred users
- Aggregating by AI source (ChatGPT, Perplexity, Bing Copilot, etc.)

### Metrics tracked

| Metric | Description |
|--------|-------------|
| **Sessions** | Total LLM-referred sessions per day/week/month |
| **Source breakdown** | Which AI engines are sending traffic |
| **Intent signals** | What type of content the AI was recommending |
| **Content type** | Landing page, blog, product, etc. |

### Setting up the tracker

LLM traffic tracking requires adding the Organiq tracker snippet to your site. Contact your workspace admin to get the snippet from the project **Settings** page.

### Using the data

Go to **AI Search → LLM Traffic** in the sidebar to view:
- Daily traffic trends from AI sources
- Source breakdown by AI engine
- Top landing pages for LLM-referred visitors
- Content type distribution`,
      },
    ],
  },

  // ─── 10. Scheduled Workflows ──────────────────────────────────────────────
  {
    id: 'scheduled-workflows',
    title: 'Scheduled Workflows',
    slug: 'scheduled-workflows',
    icon: 'Calendar',
    description: 'Automate recurring agent runs with Slack and email delivery.',
    articles: [
      {
        id: 'scheduled-overview',
        title: 'Scheduled workflows overview',
        slug: 'scheduled-overview',
        tags: ['scheduled', 'cron', 'automation', 'slack', 'email'],
        estimatedReadTime: 3,
        body: `## Scheduled workflows overview

**Scheduled workflows** automate on-demand agents to run on a recurring basis and deliver results to Slack or email.

### Pre-built templates

| Template | Schedule | Delivery |
|----------|----------|---------|
| Weekly AI Search Summary | Every Monday 9 AM | Slack or Email |
| Monthly Content Refresh Report | 1st of month 9 AM | Email |
| Weekly Keyword Decay Alert | Every Friday 9 AM | Slack |
| Technical Issues Digest | Every Monday 9 AM | Email |
| New Content Opportunities | 1st & 15th of month 9 AM | Email |

### How to set up a scheduled workflow

1. Navigate to your project → **Scheduled** under Agents in the sidebar
2. Click **"New Scheduled Workflow"**
3. Choose a **template** (or set up a custom cron expression)
4. Select the **agent type** and write your prompt
5. Set the **delivery channel**:
   - **Slack** — paste your Slack webhook URL
   - **Email** — enter the recipient email address
6. Toggle **Active** and save

### Delivery timing

- Scheduled runs check every 5 minutes for due jobs
- Email delivery: ~2–5 seconds after agent completes
- Slack delivery: ~1–2 seconds after agent completes

### Data retention

- Agent responses are stored for 30 days, then automatically deleted
- Toggle a schedule off at any time to pause without deleting it

### Billing

Scheduled workflows use the same credit costs as manual on-demand agents (3–5 credits per run). Make sure your organization has sufficient credits to cover recurring executions.`,
      },
    ],
  },

  // ─── 11. Credits & Billing ────────────────────────────────────────────────
  {
    id: 'billing',
    title: 'Credits & Billing',
    slug: 'billing',
    icon: 'CreditCard',
    description: 'Managing your credit balance, subscription plans, and purchasing additional credits.',
    articles: [
      {
        id: 'credit-system',
        title: 'How the credit system works',
        slug: 'credit-system',
        tags: ['credits', 'billing', 'balance', 'ledger'],
        estimatedReadTime: 3,
        body: `## How the credit system works

Organiq uses a **credit-based billing system**. Credits are the currency that powers all AI workflow steps and on-demand agents.

### Credit fundamentals

- Credits are shared across all projects in your organization
- Credits are **pre-checked** before a step starts — if you don't have enough, the step won't run
- Credits are **only deducted on successful completion** — failed steps are not charged
- Every transaction is recorded in an immutable **credit ledger**

### Credit ledger

The credit ledger records every credit movement:

| Type | When it happens |
|------|----------------|
| \`purchase\` | You buy credits via Stripe |
| \`usage\` | A workflow step or agent completes |
| \`refund\` | A failed step is retroactively credited back |
| \`bonus\` | Promotional credits are added to your account |

### Checking your balance

1. Click **Billing** in the sidebar (bottom section)
2. See your current balance and recent transaction history
3. Each transaction shows: date, step key, workflow run ID, amount, and running balance

### Running out of credits

If a step starts and your organization runs out of credits mid-workflow, the step will fail (not charge you) and the workflow will pause. You can:
1. Purchase more credits
2. Resume the workflow — paused steps will retry automatically`,
      },
      {
        id: 'plans-and-purchasing',
        title: 'Plans and purchasing credits',
        slug: 'plans-and-purchasing',
        tags: ['billing', 'plans', 'stripe', 'purchase', 'subscription'],
        estimatedReadTime: 2,
        body: `## Plans and purchasing credits

### Subscription plans

Organiq is available on four plans:

| Plan | Projects | Workflow Runs/Month | Agent Runs/Month |
|------|----------|---------------------|-----------------|
| **Starter** | 3 | 10 | 50 |
| **Pro** | Increased | More | More |
| **Agency** | Higher | Higher | Higher |
| **Enterprise** | Custom | Custom | Custom |

Your plan determines monthly limits on workflow and agent runs. Credits are consumed separately — they're not tied to a monthly limit, but to your purchased balance.

### Buying credits

1. Go to **Billing** in the sidebar
2. Click **"Buy Credits"**
3. Select a credit pack:
   - 50 credits
   - 500 credits
   - 2,000 credits
   - 10,000 credits
   - 50,000 credits (enterprise)
4. Complete checkout via Stripe — credits are added to your account immediately

### Managing your subscription

Click **"Manage Subscription"** in the Billing page to:
- Upgrade or downgrade your plan
- View invoice history
- Update payment method
- Cancel subscription

This opens the Stripe customer portal securely.

### Stripe security

Payment information is handled entirely by Stripe. Organiq never stores your card details — only a Stripe customer ID.`,
      },
    ],
  },
];

// ─── Search helper ────────────────────────────────────────────────────────────

export interface SearchResult {
  category: HelpCategory;
  article: HelpArticle;
  matchType: 'title' | 'tags' | 'body';
}

export function searchHelp(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const category of HELP_CATEGORIES) {
    for (const article of category.articles) {
      if (article.title.toLowerCase().includes(q)) {
        results.push({ category, article, matchType: 'title' });
      } else if (article.tags.some((t) => t.toLowerCase().includes(q))) {
        results.push({ category, article, matchType: 'tags' });
      } else if (article.body.toLowerCase().includes(q)) {
        results.push({ category, article, matchType: 'body' });
      }
    }
  }

  // Title matches first, then tags, then body
  const order: Record<string, number> = { title: 0, tags: 1, body: 2 };
  return results.sort((a, b) => order[a.matchType] - order[b.matchType]);
}
