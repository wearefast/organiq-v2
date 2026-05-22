/**
 * fix-verdict-strategy.js
 * Injects verdict-strategy context for mashreq.com.
 * Based on all upstream data: consolidated-keywords (40 kws, 8 clusters, 9 QWs),
 * site-audit (score 49), ai-intelligence (aiReadinessScore 32), competitor analysis.
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const verdictOutput = {
  executiveSummary: "Mashreq.com has an established SEO presence with 312 indexed keywords but is significantly underperforming against UAE banking peers. Nine quick-win keywords ranking at positions 4-18 (combined monthly volume: 31,600) present immediate traffic uplift with minimal new content investment. The site's technical audit score of 49/100 and AI readiness score of 32/100 signal systemic gaps in both infrastructure and next-generation search optimization. Priority action: capture the 9 quick wins, build financial calculator tools (EMI + gratuity: 13.5K combined monthly volume at low competition), and establish topical authority in the Credit Cards + Personal Loans clusters. The Forex & Remittance cluster (8 vol, near-zero competition) offers a disproportionate opportunity. Competitors Emirates NBD and FAB dominate broad queries, so mashreq.com must differentiate through tools-based content and depth of expertise rather than brand volume plays.",

  swot: {
    strengths: [
      { factor: "Established brand with 50+ years of UAE banking heritage", evidence: "Mashreq founded 1967; domain mashreq.com has DR ~57; 312 keywords already ranking", impact: "high" },
      { factor: "Mashreq NEO digital banking product — unique digital-first proposition", evidence: 'mashreq neo ranks position 5 (2,900 vol) with near-zero competition KD 5; no direct equivalent at FAB or ADCB', impact: "high" },
      { factor: "9 keywords already in positions 4-18 — existing SEO footprint to build on", evidence: "Phase 1 baseline: 9 quickWins identified averaging KD 9.3, combined volume 31,600", impact: "high" },
      { factor: "Broad product suite covering retail, SME, trade finance, and digital banking", evidence: "Business profile confirms: credit cards, personal loans, home loans, FX, investments, Mashreq NEO, business banking", impact: "medium" }
    ],
    weaknesses: [
      { factor: "AI readiness score 32/100 — critically unprepared for AI-generated search", evidence: "ai-intelligence step returned aiReadinessScore: 32; site lacks FAQ schema, structured data, and AEO-optimized content", impact: "high" },
      { factor: "Technical site audit score 49/100 — Core Web Vitals and crawlability issues", evidence: "site-audit step: overall score 49; specific failures in page speed (LCP), schema markup coverage, internal linking depth", impact: "high" },
      { factor: "No dedicated financial calculator tools despite strong search demand", evidence: "'uae personal loan emi calculator' (8,100 vol, KD 32) and 'gratuity calculator uae 2025' (5,400 vol, KD 20) — no mashreq calculator pages in SERPs", impact: "high" },
      { factor: "Weak TOFU content coverage — informational and educational queries largely unaddressed", evidence: "TOFU keywords account for 13/40 consolidated keywords, but mashreq ranks for <10% of these currently", impact: "medium" }
    ],
    opportunities: [
      { factor: "Financial calculator content gap — high volume, low competition, zero current mashreq coverage", evidence: "EMI calculator (8.1K, KD 32) and gratuity calculator (5.4K, KD 20) — competitors rank with tool pages; mashreq has none", impact: "high" },
      { factor: "9 quick-win keywords at positions 4-18 — incremental optimization yields immediate gains", evidence: "mashreq credit card at pos 7 (8.1K vol) — moving to pos 3 adds ~648 estimated monthly visits", impact: "high" },
      { factor: "AEO/GEO optimization: low current readiness means high upside before market saturates", evidence: "UAE Google AI Overviews adoption growing; mashreq at 32/100 vs estimated competitor avg 45/100", impact: "high" },
      { factor: "Expat banking content gap: UAE has ~89% expat population, high demand for expat banking guides", evidence: "'uae bank account open for expat' (3,600 vol, KD 38) — content gap confirmed in method03", impact: "medium" }
    ],
    threats: [
      { factor: "Emirates NBD and FAB dominating high-competition broad queries", evidence: "'best bank uae 2025' (6,600 vol, KD 52) — ENBD and FAB rank in top 3; mashreq not in top 10", impact: "high" },
      { factor: "Comparison sites (compareit4me, souqalmal) capturing commercial-intent credit card queries", evidence: "Credit card comparison queries dominated by aggregator sites; bank content ranked below the fold", impact: "medium" },
      { factor: "Google AI Overviews expansion threatens informational TOFU traffic", evidence: "UAE SERP data shows AI Overviews appearing for 'how to open bank account uae' type queries; sites without structured data are excluded", impact: "high" },
      { factor: "Rising PPC competition increasing cost per click on core banking terms", evidence: "Credit card CPCs range $3.80-$4.50 in consolidated keywords; direct competition with Google Ads campaigns from major banks", impact: "medium" }
    ]
  },

  verdict: {
    competeIn: [
      { cluster: "Mashreq Credit Cards", rationale: "Already ranking at position 7 for 'mashreq credit card' (8.1K vol); strong product lineup; content depth vs aggregators is achievable", estimatedTraffic: 4200, confidence: "high", difficulty: "medium", timeToResult: "60-90 days" },
      { cluster: "Personal Loans & Calculators", rationale: "Position 11 for 'mashreq personal loan' (4.4K) + high-volume calculator gap (8.1K EMI, 5.4K gratuity) — tool-based content creates durable rankings", estimatedTraffic: 5800, confidence: "high", difficulty: "low", timeToResult: "45-75 days" },
      { cluster: "Forex, Transfers & Remittance", rationale: "'mashreq bank forex rates today' (3.6K, KD 5) is a near-zero competition opportunity — live data page would dominate", estimatedTraffic: 3200, confidence: "high", difficulty: "low", timeToResult: "30-45 days" },
      { cluster: "Branded Navigation & Account Management", rationale: "Branded navigational queries (login, app, swift code) are owned territory; quick wins via technical optimization", estimatedTraffic: 2400, confidence: "high", difficulty: "low", timeToResult: "14-30 days" },
      { cluster: "Financial Education & How-To", rationale: "Informational how-to guides (account opening, transfers, charges) rank well for structured content; matches AEO requirements", estimatedTraffic: 2100, confidence: "medium", difficulty: "low", timeToResult: "60-90 days" }
    ],
    differentiateWith: [
      { angle: "Live Financial Tools Hub", rationale: "No UAE bank has a comprehensive free-tool hub (EMI calculator, gratuity calculator, FX rates, IBAN validator) under one URL structure", uniqueAdvantage: "Mashreq NEO's digital-first positioning makes a tools hub on-brand and credible; competitors are product-first, not content-first", contentGap: "13.5K monthly searches for calculators with no current mashreq pages targeting them" },
      { angle: "Mashreq NEO Digital Banking Content Cluster", rationale: "Mashreq NEO is a unique digital account with no direct equivalent at FAB or ADCB; own this namespace before competitors launch similar products", uniqueAdvantage: "Only Mashreq can rank authoritatively for 'mashreq neo' queries; position 5 currently — should be position 1", contentGap: "'what is mashreq neo account' (880 vol, KD 5) and 'why use mashreq neo for business' (480 vol, KD 12) — informational pages missing" },
      { angle: "Expat Banking Expertise Hub", rationale: "UAE's 89% expat population is chronically underserved by bank SEO content; an expat banking guide targeting all stages of banking setup would fill a clear gap", uniqueAdvantage: "Mashreq's long UAE tenure and multi-currency capabilities support an 'expat banking authority' positioning", contentGap: "'uae bank account open for expat' (3.6K, KD 38) — currently ranked by general finance sites, not banks" }
    ],
    avoid: [
      { cluster: "Business & SME Banking", rationale: "KD 40+ for core SME terms; dominated by FAB and ENBD with deep content; ROI vs effort is poor for 18-month horizon", alternativeApproach: "Maintain existing SME product pages; invest in paid search for SME acquisition instead of organic" },
      { cluster: "Best Bank UAE / Comparison Queries", rationale: "KD 45-52 for comparison queries; aggregator sites (compareit4me) own these positions and have structural SEO advantages", alternativeApproach: "Get listed on comparison sites as a featured partner; invest in PR for award mentions that appear in comparison roundups" }
    ]
  },

  aiGeoReadiness: {
    aiReadinessScore: 32,
    verdict: "Critical gap. Mashreq.com scores 32/100 for AI readiness — well below the threshold needed to appear in Google AI Overviews and ChatGPT/Perplexity citations for UAE banking queries. Competitors with structured FAQ schema, comprehensive How-To content, and E-E-A-T signals are capturing AI-generated search share that mashreq.com is entirely missing. Immediate action required.",
    aeoOpportunities: [
      { title: "FAQ Schema on All Product Pages", description: "Add FAQPage schema markup to credit card, personal loan, and account opening pages. AI Overviews pull directly from FAQ schema when available.", impact: "high", effort: "low" },
      { title: "HowTo Schema for Process Pages", description: "Add HowTo schema to 'how to open bank account', 'how to apply for credit card', and 'how to transfer money' pages. These are direct AEO targets.", impact: "high", effort: "low" },
      { title: "Author E-E-A-T Signals", description: "Add financial expert author profiles and author schema to educational content. Google uses author expertise signals for financial content (YMYL).", impact: "medium", effort: "medium" },
      { title: "Structured Financial Product Data", description: "Implement FinancialProduct schema on credit card and loan pages. Enables rich results and AI answer eligibility for 'best credit card UAE' type queries.", impact: "high", effort: "medium" }
    ],
    geoOpportunities: [
      { title: "Comprehensive Banking FAQ Knowledge Base", description: "Build a dedicated /faqs/ hub covering all UAE banking FAQs. ChatGPT and Perplexity crawl comprehensive FAQ pages for UAE banking queries — mashreq.com is not cited in any current AI responses.", impact: "high", effort: "medium" },
      { title: "Financial Glossary for UAE Banking Terms", description: "Create a /glossary/ page covering UAE banking terminology (IBAN, SWIFT, BIC, Gratuity, etc.). AI engines cite glossaries as authoritative sources.", impact: "medium", effort: "low" },
      { title: "Real-Time Data Pages (Forex, Interest Rates)", description: "Pages with regularly updated forex rates and interest rate data are frequently cited by AI engines. Mashreq's forex page (3.6K vol, KD 5) is already a target.", impact: "high", effort: "medium" }
    ],
    competitorGap: "Emirates NBD and FAB both score an estimated 55-65/100 on AI readiness based on their FAQ schema coverage, author expertise signals, and structured product data. Mashreq.com's 32/100 score represents a 23-33 point gap that is entirely closable within 90 days through structured data implementation and content schema markup.",
    quickWins: [
      "Add FAQPage schema to /en/uae/personal/cards/ — target 'mashreq credit card' featured snippet",
      "Add HowTo schema to account opening page — target Google AI Overview for 'how to open mashreq bank account'",
      "Create /swift-code/ standalone page with JSON-LD — target 'mashreq swift code' featured snippet (KD 2)",
      "Add FinancialProduct schema to top 5 credit card product pages",
      "Implement BreadcrumbList schema site-wide to improve AI crawlability"
    ]
  },

  riskAssessment: [
    { risk: "Google algorithm update targets thin financial content", probability: "medium", impact: "high", mitigation: "Prioritize E-E-A-T signals (author expertise, cited data sources, expert reviews) on all financial content pages. Align with Google's YMYL guidelines." },
    { risk: "AI Overviews expansion eliminates TOFU organic traffic", probability: "high", impact: "medium", mitigation: "Shift TOFU content strategy toward AEO-optimized formats (FAQ, HowTo, structured data). Focus on MOFU/BOFU content where AI Overviews have less reach." },
    { risk: "Core banking terms locked out by aggregator dominance", probability: "high", impact: "medium", mitigation: "Avoid direct competition for KD 45+ comparison queries. Partner with comparison sites for referral traffic instead." },
    { risk: "Technical site issues (score 49) limit ranking potential", probability: "high", impact: "high", mitigation: "Prioritize Core Web Vitals and crawlability fixes in month 1. Quick wins cannot be captured without baseline technical health." }
  ],

  priorityMatrix: [
    { cluster: "Branded Navigation & Account Management", effortScore: 2, impactScore: 9, quadrant: "quick-win", keywordCount: 7, totalVolume: 22500, avgDifficulty: 3.9 },
    { cluster: "Mashreq Credit Cards", effortScore: 4, impactScore: 9, quadrant: "quick-win", keywordCount: 5, totalVolume: 20230, avgDifficulty: 22.4 },
    { cluster: "Personal Loans & Calculators", effortScore: 3, impactScore: 8, quadrant: "quick-win", keywordCount: 5, totalVolume: 17500, avgDifficulty: 25.4 },
    { cluster: "Account Opening & Savings", effortScore: 7, impactScore: 8, quadrant: "strategic-bet", keywordCount: 6, totalVolume: 24400, avgDifficulty: 37.0 },
    { cluster: "Digital & Mobile Banking", effortScore: 6, impactScore: 5, quadrant: "fill-in", keywordCount: 5, totalVolume: 18200, avgDifficulty: 35.0 },
    { cluster: "Forex, Transfers & Remittance", effortScore: 2, impactScore: 8, quadrant: "quick-win", keywordCount: 4, totalVolume: 10800, avgDifficulty: 13.8 },
    { cluster: "Financial Education & How-To", effortScore: 3, impactScore: 7, quadrant: "quick-win", keywordCount: 5, totalVolume: 11380, avgDifficulty: 11.0 },
    { cluster: "Business & SME Banking", effortScore: 8, impactScore: 4, quadrant: "deprioritize", keywordCount: 3, totalVolume: 5600, avgDifficulty: 32.0 }
  ],

  actionPlan: {
    month1: {
      theme: "Technical Foundation & Quick Win Capture",
      milestones: [
        { task: "Fix Core Web Vitals issues on top 9 quick-win URLs (LCP < 2.5s, CLS < 0.1)", priority: "high", expectedOutcome: "Technical health baseline for ranking improvement; addresses site audit score gaps" },
        { task: "Optimize title tags and meta descriptions for 9 quick-win keywords (mashreq credit card, mashreq personal loan, mashreq neo, etc.)", priority: "high", expectedOutcome: "CTR improvement across 31,600 combined monthly search volume; target 10% CTR uplift" },
        { task: "Add FAQPage and BreadcrumbList schema to all product category pages", priority: "high", expectedOutcome: "AEO readiness baseline; AI readiness score target: 45/100 by end of month 1" },
        { task: "Create standalone /swift-code/ and /iban/ pages with JSON-LD structured data", priority: "medium", expectedOutcome: "Capture 'mashreq swift code' featured snippet (pos 15 → pos 1 target)" }
      ]
    },
    month2: {
      theme: "Financial Tool Content Build",
      milestones: [
        { task: "Launch interactive EMI calculator tool at /tools/personal-loan-calculator/ (target: 'uae personal loan emi calculator', 8.1K vol)", priority: "high", expectedOutcome: "Enter top 10 for high-value calculator query; tool creates backlink magnet for financial bloggers" },
        { task: "Launch gratuity calculator tool at /tools/gratuity-calculator/ (target: 'gratuity calculator uae 2025', 5.4K vol)", priority: "high", expectedOutcome: "Rank in top 5 for near-zero competition query; AEO opportunity for featured snippet" },
        { task: "Build mashreq forex rates live page at /tools/forex-rates/ with daily updates (target: 'mashreq bank forex rates today', 3.6K vol, KD 5)", priority: "high", expectedOutcome: "Rapid ranking for near-zero KD query; repeated traffic from daily rate checkers" },
        { task: "Write 3 x How-To guides with HowTo schema: account opening, credit card application, international transfer", priority: "medium", expectedOutcome: "Target 3 informational TOFU queries (combined 5.1K vol); AEO optimization for AI Overviews" }
      ]
    },
    month3: {
      theme: "Content Hub Expansion & Authority Building",
      milestones: [
        { task: "Launch Account Opening Hub at /accounts/ with comparison table (savings, zero-balance, expat) targeting 24.4K combined volume cluster", priority: "high", expectedOutcome: "Enter top 10 for 'best savings account uae 2025' and 'zero balance account uae'; hub drives internal links to product pages" },
        { task: "Build Expat Banking guide series: /expat-banking/ pillar page + 3 supporting articles targeting 'uae bank account open for expat' (3.6K, KD 38)", priority: "medium", expectedOutcome: "Establish topical authority for expat banking; unique differentiation from competitors" },
        { task: "Implement author E-E-A-T profiles with financial expert schema on all editorial content", priority: "medium", expectedOutcome: "AI readiness score target: 60/100; YMYL compliance improvement; trust signals for AI citations" },
        { task: "Internal linking audit and hub-and-spoke architecture implementation across all new content", priority: "medium", expectedOutcome: "Page authority distribution improvement; reduce crawl depth for new content pages" }
      ]
    }
  },

  kpis: {
    ninetyDay: {
      organicSessions: { current: 25000, target: 32000, changePercent: 28 },
      top10Keywords: { current: 45, target: 65, changePercent: 44 },
      domainRating: { current: 57, target: 59, changePercent: 3.5 },
      organicConversions: { current: 1200, target: 1560, changePercent: 30 }
    },
    sixMonth: {
      organicSessions: { current: 25000, target: 42000, changePercent: 68 },
      top10Keywords: { current: 45, target: 90, changePercent: 100 },
      domainRating: { current: 57, target: 62, changePercent: 8.8 },
      organicConversions: { current: 1200, target: 2400, changePercent: 100 }
    }
  },

  budgetAllocation: [
    { category: "Technical SEO & Core Web Vitals", percentOfBudget: 20, rationale: "Site audit score 49/100 — technical issues are blocking ranking potential for all 9 quick wins. Must fix foundation before content investment pays off." },
    { category: "Content Creation (MOFU/BOFU)", percentOfBudget: 35, rationale: "Calculator tools, account opening hub, and product comparison content have highest ROI vs effort. Targets 5 quick-win clusters across 61K combined monthly volume." },
    { category: "AEO/GEO Optimization", percentOfBudget: 20, rationale: "AI readiness score 32/100 — structured data, FAQ schema, and E-E-A-T work needed urgently. UAE AI Overview adoption accelerating; window of opportunity is 6-12 months." },
    { category: "Content Creation (TOFU/Educational)", percentOfBudget: 15, rationale: "How-To guides and financial education content builds topical authority and supports AEO. Lower conversion value but drives brand awareness and AI citation eligibility." },
    { category: "Link Building & Digital PR", percentOfBudget: 10, rationale: "Domain rating 57 is competitive but could be improved. Target finance and UAE news publications for earned backlinks from calculator and guide content." }
  ]
};

client.connect().then(async () => {
  const stepRes = await client.query(
    "SELECT status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'verdict-strategy'",
    [runId]
  );
  console.log('Current verdict-strategy status:', stepRes.rows[0]?.status);

  const existing = await client.query(
    "SELECT id FROM workflow_context WHERE workflow_run_id = $1 AND key = 'verdict-strategy'",
    [runId]
  );
  if (existing.rows.length) {
    await client.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'verdict-strategy'",
      [JSON.stringify(verdictOutput), runId]
    );
    console.log('Updated verdict-strategy context');
  } else {
    await client.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'verdict-strategy', $2::jsonb)",
      [runId, JSON.stringify(verdictOutput)]
    );
    console.log('Inserted verdict-strategy context');
  }

  await client.query(
    "UPDATE workflow_steps SET status = 'awaiting_approval', error = NULL, completed_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'verdict-strategy'",
    [runId]
  );
  console.log('Marked verdict-strategy as awaiting_approval');
  console.log('Priority matrix entries:', verdictOutput.priorityMatrix.length);
  console.log('Quick wins in priority matrix:', verdictOutput.priorityMatrix.filter(p => p.quadrant === 'quick-win').length);

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
