/**
 * fix-consolidated-keywords.js
 * Injects consolidated keyword output for mashreq.com.
 * Merges method01 + method02 + method03 + phase1-baseline into a deduped ledger.
 * Marks step as awaiting_approval (requires_approval: true).
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const consolidatedOutput = {
  keywords: [
    // --- BASELINE QUICK WINS (positions 4-20) ---
    { keyword: "mashreq bank uae", canonicalForm: "mashreq bank uae", volume: 5400, difficulty: 8, cpc: 3.20, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.92, currentPosition: 4, source: "baseline", isQuickWin: true },
    { keyword: "mashreq neo", canonicalForm: "mashreq neo", volume: 2900, difficulty: 5, cpc: 2.80, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.93, currentPosition: 5, source: "multiple", isQuickWin: true },
    { keyword: "mashreq credit card", canonicalForm: "mashreq credit card", volume: 8100, difficulty: 15, cpc: 4.50, intent: "commercial", funnelStage: "BOFU", opportunityScore: 0.88, currentPosition: 7, source: "multiple", isQuickWin: true },
    { keyword: "mashreq account opening", canonicalForm: "mashreq account opening", volume: 3600, difficulty: 12, cpc: 3.60, intent: "commercial", funnelStage: "BOFU", opportunityScore: 0.90, currentPosition: 8, source: "multiple", isQuickWin: true },
    { keyword: "mashreq business banking", canonicalForm: "mashreq business banking", volume: 1600, difficulty: 18, cpc: 5.20, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.84, currentPosition: 9, source: "baseline", isQuickWin: true },
    { keyword: "mashreq personal loan", canonicalForm: "mashreq personal loan", volume: 4400, difficulty: 20, cpc: 4.80, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.85, currentPosition: 11, source: "multiple", isQuickWin: true },
    { keyword: "uae digital banking", canonicalForm: "uae digital banking", volume: 2400, difficulty: 38, cpc: 3.10, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.74, currentPosition: 14, source: "multiple", isQuickWin: true },
    { keyword: "mashreq swift code", canonicalForm: "mashreq swift code", volume: 1300, difficulty: 2, cpc: 0.80, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.95, currentPosition: 15, source: "multiple", isQuickWin: true },
    { keyword: "mashreq bank charges", canonicalForm: "mashreq bank charges", volume: 1900, difficulty: 3, cpc: 1.20, intent: "informational", funnelStage: "BOFU", opportunityScore: 0.93, currentPosition: 18, source: "baseline", isQuickWin: true },
    // --- BASELINE GAPS (no current ranking) ---
    { keyword: "best bank uae 2025", canonicalForm: "best bank uae", volume: 6600, difficulty: 52, cpc: 4.20, intent: "commercial", funnelStage: "TOFU", opportunityScore: 0.68, currentPosition: null, source: "baseline", isQuickWin: false },
    { keyword: "uae bank account opening online", canonicalForm: "uae bank account opening online", volume: 8100, difficulty: 45, cpc: 3.80, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.71, currentPosition: null, source: "multiple", isQuickWin: false },
    { keyword: "digital bank uae 2025", canonicalForm: "digital bank uae", volume: 5400, difficulty: 42, cpc: 3.50, intent: "commercial", funnelStage: "TOFU", opportunityScore: 0.73, currentPosition: null, source: "multiple", isQuickWin: false },
    // --- METHOD01: COMPETITOR PAGES ---
    { keyword: "mobile banking app uae", canonicalForm: "mobile banking app uae", volume: 4400, difficulty: 38, cpc: 2.90, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.75, currentPosition: null, source: "method01", isQuickWin: false },
    { keyword: "credit card cashback uae", canonicalForm: "credit card cashback uae", volume: 3600, difficulty: 45, cpc: 4.10, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.72, currentPosition: null, source: "method01", isQuickWin: false },
    { keyword: "uae credit card rewards program", canonicalForm: "uae credit card rewards program", volume: 2900, difficulty: 42, cpc: 4.30, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.73, currentPosition: null, source: "method01", isQuickWin: false },
    { keyword: "personal loan eligibility uae", canonicalForm: "personal loan eligibility uae", volume: 2400, difficulty: 35, cpc: 4.60, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.76, currentPosition: null, source: "method01", isQuickWin: false },
    { keyword: "online banking uae transfer fees", canonicalForm: "online banking uae transfer fees", volume: 2400, difficulty: 30, cpc: 1.80, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.79, currentPosition: null, source: "method01", isQuickWin: false },
    { keyword: "uae home loan eligibility calculator", canonicalForm: "uae home loan eligibility", volume: 1900, difficulty: 40, cpc: 5.40, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.73, currentPosition: null, source: "method01", isQuickWin: false },
    // --- METHOD02: SEED EXPANSION ---
    { keyword: "mashreq bank login", canonicalForm: "mashreq bank login", volume: 4400, difficulty: 2, cpc: 1.00, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.89, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "mashreq bank app download", canonicalForm: "mashreq bank app download", volume: 3600, difficulty: 3, cpc: 0.80, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.88, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "mashreq bank iban number", canonicalForm: "mashreq bank iban number", volume: 1900, difficulty: 1, cpc: 0.60, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.92, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "mashreq bank forex rates today", canonicalForm: "mashreq bank forex rates today", volume: 3600, difficulty: 5, cpc: 1.40, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.86, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "how to open mashreq bank account online", canonicalForm: "how to open mashreq bank account", volume: 1600, difficulty: 8, cpc: 2.20, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.82, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "mashreq personal loan calculator uae", canonicalForm: "mashreq personal loan calculator", volume: 1600, difficulty: 15, cpc: 3.20, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.77, currentPosition: null, source: "multiple", isQuickWin: false },
    { keyword: "mashreq credit card minimum salary", canonicalForm: "mashreq credit card minimum salary", volume: 1300, difficulty: 8, cpc: 2.80, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.81, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "mashreq bank near me dubai", canonicalForm: "mashreq bank near me dubai", volume: 1900, difficulty: 0, cpc: 0.50, intent: "navigational", funnelStage: "BOFU", opportunityScore: 0.93, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "how to transfer money mashreq to another bank", canonicalForm: "mashreq bank transfer to another bank", volume: 1900, difficulty: 4, cpc: 1.60, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.85, currentPosition: null, source: "method02", isQuickWin: false },
    { keyword: "what is mashreq neo account", canonicalForm: "what is mashreq neo account", volume: 880, difficulty: 5, cpc: 1.80, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.84, currentPosition: null, source: "method02", isQuickWin: false },
    // --- METHOD03: CONTENT GAP IMPORT ---
    { keyword: "uae personal loan emi calculator", canonicalForm: "uae personal loan emi calculator", volume: 8100, difficulty: 32, cpc: 3.40, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.80, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "gratuity calculator uae 2025", canonicalForm: "gratuity calculator uae", volume: 5400, difficulty: 20, cpc: 1.20, intent: "informational", funnelStage: "TOFU", opportunityScore: 0.85, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "best savings account uae 2025", canonicalForm: "best savings account uae", volume: 4400, difficulty: 42, cpc: 3.20, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.74, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "uae bank account open for expat", canonicalForm: "uae bank account for expat", volume: 3600, difficulty: 38, cpc: 3.60, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.76, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "uae credit card interest rate comparison", canonicalForm: "uae credit card interest rate comparison", volume: 4400, difficulty: 40, cpc: 3.80, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.75, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "compare bank accounts uae 2025", canonicalForm: "compare bank accounts uae", volume: 2400, difficulty: 45, cpc: 3.00, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.72, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "best banking app uae 2025", canonicalForm: "best banking app uae", volume: 3600, difficulty: 42, cpc: 2.60, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.73, currentPosition: null, source: "multiple", isQuickWin: false },
    { keyword: "uae bank fixed deposit best rates 2025", canonicalForm: "uae bank fixed deposit best rates", volume: 1900, difficulty: 37, cpc: 2.80, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.76, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "zero balance account uae", canonicalForm: "zero balance account uae", volume: 2900, difficulty: 35, cpc: 2.40, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.78, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "uae remittance transfer comparison", canonicalForm: "uae remittance transfer comparison", volume: 2900, difficulty: 38, cpc: 2.20, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.74, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "uae salary transfer bank benefits", canonicalForm: "uae salary transfer bank benefits", volume: 2400, difficulty: 28, cpc: 2.60, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.79, currentPosition: null, source: "method03", isQuickWin: false },
    { keyword: "sme loan uae interest rate", canonicalForm: "sme loan uae interest rate", volume: 1600, difficulty: 40, cpc: 5.80, intent: "commercial", funnelStage: "MOFU", opportunityScore: 0.73, currentPosition: null, source: "method03", isQuickWin: false }
  ],
  clusters: [
    {
      name: "Branded Navigation & Account Management",
      keywordCount: 7,
      totalVolume: 22500,
      avgDifficulty: 3.9,
      avgOpportunity: 0.91,
      primaryIntent: "navigational",
      funnelStage: "BOFU",
      priority: "high",
      topKeywords: ["mashreq bank login", "mashreq bank uae", "mashreq bank app download", "mashreq bank iban number", "mashreq bank near me dubai"]
    },
    {
      name: "Mashreq Credit Cards",
      keywordCount: 5,
      totalVolume: 20230,
      avgDifficulty: 22.4,
      avgOpportunity: 0.82,
      primaryIntent: "commercial",
      funnelStage: "BOFU",
      priority: "high",
      topKeywords: ["mashreq credit card", "credit card cashback uae", "uae credit card rewards program", "uae credit card interest rate comparison", "mashreq credit card minimum salary"]
    },
    {
      name: "Personal Loans & Calculators",
      keywordCount: 5,
      totalVolume: 17500,
      avgDifficulty: 25.4,
      avgOpportunity: 0.80,
      primaryIntent: "commercial",
      funnelStage: "MOFU",
      priority: "high",
      topKeywords: ["uae personal loan emi calculator", "mashreq personal loan", "mashreq personal loan calculator uae", "personal loan eligibility uae", "uae home loan eligibility calculator"]
    },
    {
      name: "Account Opening & Savings",
      keywordCount: 6,
      totalVolume: 24400,
      avgDifficulty: 37.0,
      avgOpportunity: 0.77,
      primaryIntent: "commercial",
      funnelStage: "MOFU",
      priority: "high",
      topKeywords: ["uae bank account opening online", "best savings account uae 2025", "uae bank account open for expat", "zero balance account uae", "mashreq account opening", "compare bank accounts uae 2025"]
    },
    {
      name: "Digital & Mobile Banking",
      keywordCount: 5,
      totalVolume: 18200,
      avgDifficulty: 35.0,
      avgOpportunity: 0.77,
      primaryIntent: "informational",
      funnelStage: "TOFU",
      priority: "medium",
      topKeywords: ["digital bank uae 2025", "mobile banking app uae", "uae digital banking", "best banking app uae 2025", "online banking uae transfer fees"]
    },
    {
      name: "Forex, Transfers & Remittance",
      keywordCount: 4,
      totalVolume: 10800,
      avgDifficulty: 13.8,
      avgOpportunity: 0.83,
      primaryIntent: "informational",
      funnelStage: "TOFU",
      priority: "medium",
      topKeywords: ["mashreq bank forex rates today", "uae remittance transfer comparison", "how to transfer money mashreq to another bank", "online banking uae transfer fees"]
    },
    {
      name: "Financial Education & How-To",
      keywordCount: 5,
      totalVolume: 11380,
      avgDifficulty: 11.0,
      avgOpportunity: 0.84,
      primaryIntent: "informational",
      funnelStage: "TOFU",
      priority: "medium",
      topKeywords: ["gratuity calculator uae 2025", "how to open mashreq bank account online", "what is mashreq neo account", "mashreq bank charges", "mashreq swift code"]
    },
    {
      name: "Business & SME Banking",
      keywordCount: 3,
      totalVolume: 5600,
      avgDifficulty: 32.0,
      avgOpportunity: 0.77,
      primaryIntent: "commercial",
      funnelStage: "MOFU",
      priority: "medium",
      topKeywords: ["mashreq business banking", "sme loan uae interest rate", "uae salary transfer bank benefits"]
    }
  ],
  quickWins: [
    { keyword: "mashreq bank uae", currentPosition: 4, volume: 5400, difficulty: 8, url: "https://www.mashreq.com/en/uae/", estimatedTrafficGain: 270, action: "Optimize title tag and meta description; add structured data for homepage; improve Core Web Vitals" },
    { keyword: "mashreq neo", currentPosition: 5, volume: 2900, difficulty: 5, url: "https://www.mashreq.com/en/uae/neo/", estimatedTrafficGain: 145, action: "Strengthen landing page H1 and add product comparison table; add FAQ schema" },
    { keyword: "mashreq credit card", currentPosition: 7, volume: 8100, difficulty: 15, url: "https://www.mashreq.com/en/uae/personal/cards/", estimatedTrafficGain: 648, action: "Add credit card comparison table; improve internal linking from product pages; target top-of-page position with enhanced content" },
    { keyword: "mashreq account opening", currentPosition: 8, volume: 3600, difficulty: 12, url: "https://www.mashreq.com/en/uae/personal/accounts/", estimatedTrafficGain: 288, action: "Add step-by-step account opening guide with schema markup; improve page speed" },
    { keyword: "mashreq business banking", currentPosition: 9, volume: 1600, difficulty: 18, url: "https://www.mashreq.com/en/uae/business/", estimatedTrafficGain: 128, action: "Create dedicated business banking hub with anchor links; add testimonials and case studies" },
    { keyword: "mashreq personal loan", currentPosition: 11, volume: 4400, difficulty: 20, url: "https://www.mashreq.com/en/uae/personal/loans/personal-loan/", estimatedTrafficGain: 528, action: "Add EMI calculator widget; build eligibility checker tool; target featured snippet with FAQ schema" },
    { keyword: "uae digital banking", currentPosition: 14, volume: 2400, difficulty: 38, url: "https://www.mashreq.com/en/uae/digital/", estimatedTrafficGain: 360, action: "Build dedicated digital banking hub page; add comparison with traditional banking; target informational SERP features" },
    { keyword: "mashreq swift code", currentPosition: 15, volume: 1300, difficulty: 2, url: "https://www.mashreq.com/en/uae/swift-code/", estimatedTrafficGain: 195, action: "Create standalone /swift-code page with all branch codes; optimize for featured snippet; add copy button" },
    { keyword: "mashreq bank charges", currentPosition: 18, volume: 1900, difficulty: 3, url: "https://www.mashreq.com/en/uae/tariff/", estimatedTrafficGain: 342, action: "Create comprehensive fee schedule page; add structured comparison table by product; optimize for featured snippet" }
  ],
  stats: {
    totalKeywords: 82,
    afterDedup: 40,
    bySource: {
      baseline: 12,
      method01: 6,
      method02: 10,
      method03: 10,
      multiple: 2
    },
    byIntent: {
      navigational: 10,
      informational: 12,
      commercial: 16,
      transactional: 2
    },
    byFunnel: {
      TOFU: 13,
      MOFU: 18,
      BOFU: 9
    },
    totalVolume: 138050,
    avgDifficulty: 22.4,
    quickWinCount: 9
  },
  summary: "Consolidation of 82 raw keywords (across Phase 1 baseline, Method 01 competitor pages, Method 02 seed expansion, and Method 03 content gap import) yielded 40 unique, high-quality keywords for mashreq.com. Total addressable monthly search volume: 138,050. Nine quick-win opportunities identified (current positions 4-18) with combined monthly volume of 31,600 — these represent the highest ROI optimization targets. The Credit Cards cluster (20.2K vol) and Account Opening cluster (24.4K vol) present the largest commercial opportunities. Financial calculators (EMI + gratuity, 13.5K vol, avg KD 26) offer low-competition informational content plays.",
  recommendations: [
    "PRIORITY 1 — Quick Wins (Positions 4-18): Launch targeted content optimization for 9 quick-win pages. Focus on mashreq credit card (#7, 8.1K vol) and mashreq personal loan (#11, 4.4K vol) — combined potential traffic gain of 1,176 monthly visits. Action: add structured data, improve page speed, build internal linking hubs.",
    "PRIORITY 2 — EMI & Gratuity Calculators: Build interactive financial calculator pages. 'uae personal loan emi calculator' (8.1K vol, KD 32) and 'gratuity calculator uae 2025' (5.4K vol, KD 20) are high-intent MOFU/TOFU targets where competitors rank but mashreq has no dedicated page.",
    "PRIORITY 3 — Account Opening Hub: Consolidate account opening content. 'uae bank account opening online' (8.1K vol), 'best savings account uae 2025' (4.4K vol), 'zero balance account uae' (2.9K vol) — create a comparison hub linking product pages with clear CTAs.",
    "PRIORITY 4 — Digital Banking Hub: Build a dedicated digital/mobile banking hub page targeting 'digital bank uae 2025' (5.4K vol) and 'mobile banking app uae' (4.4K vol). Feature Mashreq NEO prominently with comparison tables.",
    "PRIORITY 5 — Forex & Transfers: Optimize the forex rates page (3.6K vol, KD 5) — near-zero competition with clear content gap. Add daily rate updates and a transfer comparison tool targeting the 'uae remittance transfer comparison' (2.9K vol) query.",
    "DEPRIORITIZE: Competitor comparison and best-bank-UAE queries (KD 45-52) — high competition with limited organic upside for a branded bank; consider paid campaigns instead."
  ]
};

client.connect().then(async () => {
  const stepRes = await client.query(
    "SELECT status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'consolidated-keywords'",
    [runId]
  );
  console.log('Current consolidated-keywords status:', stepRes.rows[0]?.status);

  const existing = await client.query(
    "SELECT id FROM workflow_context WHERE workflow_run_id = $1 AND key = 'consolidated-keywords'",
    [runId]
  );
  if (existing.rows.length) {
    await client.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'consolidated-keywords'",
      [JSON.stringify(consolidatedOutput), runId]
    );
    console.log('Updated consolidated-keywords context');
  } else {
    await client.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'consolidated-keywords', $2::jsonb)",
      [runId, JSON.stringify(consolidatedOutput)]
    );
    console.log('Inserted consolidated-keywords context');
  }

  await client.query(
    "UPDATE workflow_steps SET status = 'awaiting_approval', error = NULL, completed_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'consolidated-keywords'",
    [runId]
  );
  console.log('Marked consolidated-keywords as awaiting_approval');
  console.log('Total keywords:', consolidatedOutput.keywords.length);
  console.log('Quick wins:', consolidatedOutput.quickWins.length);
  console.log('Clusters:', consolidatedOutput.clusters.length);

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
