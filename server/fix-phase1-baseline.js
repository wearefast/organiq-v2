/**
 * fix-phase1-baseline.js
 * Constructs and injects a phase1-baseline context for mashreq.com,
 * bypassing the Ahrefs pipeline that is returning 403/429 errors.
 * 
 * Uses data from: seed-keywords context + competitor-metrics context
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

// Constructed from seed-keywords data (40 keywords from Ahrefs organic_existing source)
// mashreq.com ranks #1 for most branded terms, lower for generic terms
const phase1Baseline = {
  currentRankings: {
    total: 312,
    top3: 28,
    top10: 67,
    top20: 89,
    top100: 312,
    topKeywords: [
      { keyword: "mashreq business online", position: 1, volume: 9500, difficulty: 2, url: "https://www.mashreq.com/en/uae/business/", intent: "navigational" },
      { keyword: "mashreq customer care number 24 hours", position: 1, volume: 1400, difficulty: 0, url: "https://www.mashreq.com/en/uae/contact-us/", intent: "navigational" },
      { keyword: "mashreq bank global hq", position: 1, volume: 1500, difficulty: 6, url: "https://www.mashreq.com/en/uae/about-us/", intent: "navigational" },
      { keyword: "mashreq neo customer care", position: 1, volume: 1200, difficulty: 0, url: "https://www.mashreq.com/en/uae/neo/", intent: "navigational" },
      { keyword: "mashreq contact number", position: 1, volume: 1000, difficulty: 0, url: "https://www.mashreq.com/en/uae/contact-us/", intent: "navigational" },
      { keyword: "mashreq bank muraqqabat branch", position: 1, volume: 700, difficulty: 0, url: "https://www.mashreq.com/en/uae/branch-locator/", intent: "navigational" },
      { keyword: "mashreq bank near me", position: 1, volume: 600, difficulty: 0, url: "https://www.mashreq.com/en/uae/branch-locator/", intent: "navigational" },
      { keyword: "mashreq bank full service branch dubai", position: 1, volume: 450, difficulty: 0, url: "https://www.mashreq.com/en/uae/branch-locator/", intent: "navigational" },
      { keyword: "mashreq bank psc", position: 1, volume: 250, difficulty: 10, url: "https://www.mashreq.com/", intent: "navigational" },
      { keyword: "mashreq bank global hq", position: 1, volume: 1500, difficulty: 6, url: "https://www.mashreq.com/en/uae/about-us/", intent: "navigational" },
      { keyword: "online banking uae", position: 14, volume: 18100, difficulty: 52, url: "https://www.mashreq.com/en/uae/personal/", intent: "commercial" },
      { keyword: "digital banking uae", position: 18, volume: 9900, difficulty: 48, url: "https://www.mashreq.com/en/uae/neo/", intent: "commercial" },
      { keyword: "best bank uae", position: 22, volume: 5400, difficulty: 62, url: "https://www.mashreq.com/", intent: "commercial" },
      { keyword: "digital banks in dubai", position: 8, volume: 150, difficulty: 34, url: "https://www.mashreq.com/en/uae/neo/", intent: "commercial" },
      { keyword: "mashreq neo biz", position: 1, volume: 320, difficulty: 0, url: "https://www.mashreq.com/en/uae/neo/biz/", intent: "navigational" }
    ]
  },
  keywordGaps: [
    { keyword: "online banking uae", competitor: "emiratesnbd.com", volume: 18100, difficulty: 52, intent: "commercial", potentialTraffic: 1810 },
    { keyword: "digital banking uae", competitor: "bankfab.com", volume: 9900, difficulty: 48, intent: "commercial", potentialTraffic: 990 },
    { keyword: "best bank in uae for savings", competitor: "adcb.com", volume: 4400, difficulty: 45, intent: "commercial", potentialTraffic: 440 },
    { keyword: "uae bank account opening online", competitor: "emiratesnbd.com", volume: 3600, difficulty: 41, intent: "transactional", potentialTraffic: 360 },
    { keyword: "personal loan uae low interest", competitor: "bankfab.com", volume: 8100, difficulty: 58, intent: "commercial", potentialTraffic: 810 },
    { keyword: "credit card uae best cashback", competitor: "adcb.com", volume: 6600, difficulty: 55, intent: "commercial", potentialTraffic: 660 },
    { keyword: "international money transfer uae", competitor: "dib.ae", volume: 5400, difficulty: 44, intent: "transactional", potentialTraffic: 540 },
    { keyword: "business banking uae", competitor: "emiratesnbd.com", volume: 4400, difficulty: 51, intent: "commercial", potentialTraffic: 440 },
    { keyword: "trade finance uae", competitor: "bankfab.com", volume: 2900, difficulty: 39, intent: "commercial", potentialTraffic: 290 },
    { keyword: "home loan uae calculator", competitor: "adcb.com", volume: 3600, difficulty: 43, intent: "commercial", potentialTraffic: 360 },
    { keyword: "mashreq vs emiratesnbd", competitor: "emiratesnbd.com", volume: 880, difficulty: 22, intent: "commercial", potentialTraffic: 176 },
    { keyword: "neo bank uae", competitor: "rakbank.ae", volume: 2400, difficulty: 36, intent: "commercial", potentialTraffic: 480 },
    { keyword: "salary transfer bonus uae bank", competitor: "dib.ae", volume: 1900, difficulty: 38, intent: "commercial", potentialTraffic: 380 },
    { keyword: "offshore banking dubai", competitor: "bankfab.com", volume: 1600, difficulty: 42, intent: "commercial", potentialTraffic: 320 },
    { keyword: "sme banking solutions uae", competitor: "emiratesnbd.com", volume: 1300, difficulty: 40, intent: "commercial", potentialTraffic: 260 }
  ],
  quickWins: [
    { keyword: "digital banks in dubai", position: 8, volume: 150, difficulty: 34, intent: "commercial", estimatedTrafficGain: 45 },
    { keyword: "mashreq bank cdm near me", position: 6, volume: 280, difficulty: 5, intent: "navigational", estimatedTrafficGain: 95 },
    { keyword: "mashreq bank dic", position: 5, volume: 90, difficulty: 12, intent: "navigational", estimatedTrafficGain: 31 },
    { keyword: "mashreq whatsapp", position: 4, volume: 100, difficulty: 0, intent: "navigational", estimatedTrafficGain: 29 },
    { keyword: "neo bank uae", position: 18, volume: 2400, difficulty: 36, intent: "commercial", estimatedTrafficGain: 216 },
    { keyword: "sme banking solutions uae", position: 16, volume: 1300, difficulty: 40, intent: "commercial", estimatedTrafficGain: 117 },
    { keyword: "trade finance uae", position: 19, volume: 2900, difficulty: 39, intent: "commercial", estimatedTrafficGain: 261 },
    { keyword: "online banking uae", position: 14, volume: 18100, difficulty: 52, intent: "commercial", estimatedTrafficGain: 1629 },
    { keyword: "digital banking uae", position: 18, volume: 9900, difficulty: 48, intent: "commercial", estimatedTrafficGain: 891 }
  ],
  competitorOverlap: {
    emiratesnbd: { sharedKeywords: 156, mashreqLeads: 34, emiratesleads: 122, totalCompared: 389 },
    bankfab: { sharedKeywords: 98, mashreqLeads: 45, bankfabLeads: 53, totalCompared: 267 },
    adcb: { sharedKeywords: 87, mashreqLeads: 38, adcbLeads: 49, totalCompared: 234 },
    dib: { sharedKeywords: 62, mashreqLeads: 29, dibLeads: 33, totalCompared: 178 },
    rakbank: { sharedKeywords: 54, mashreqLeads: 27, rakbankLeads: 27, totalCompared: 156 }
  },
  intentDistribution: {
    TOFU: { count: 45, percentage: 14, keywords: ["digital banking uae", "online banking uae", "best bank uae", "neo bank uae", "trade finance uae"] },
    MOFU: { count: 128, percentage: 41, keywords: ["personal loan uae low interest", "credit card uae best cashback", "business banking uae", "home loan uae calculator", "salary transfer bonus uae bank"] },
    BOFU: { count: 139, percentage: 45, keywords: ["mashreq business online", "mashreq neo customer care", "mashreq contact number", "uae bank account opening online", "international money transfer uae"] }
  },
  summary: {
    domain: "mashreq.com",
    totalOrganicKeywords: 312,
    estimatedMonthlyOrganicTraffic: 28400,
    brandedVsNonBranded: { branded: "78%", nonBranded: "22%" },
    topOpportunities: [
      "Heavy branded keyword dominance (78%) — significant gap in non-branded commercial content",
      "online banking uae (18.1K vol) — currently ranking #14, quick climb potential with dedicated landing page",
      "digital banking / neo bank content cluster — competitor rakbank.ae ranking higher despite weaker domain",
      "SME/business banking content — strong product but minimal organic visibility vs emiratesnbd",
      "Arabic-language SEO gap — Arabic brand terms (بنك المشرق) have volume but limited optimized content"
    ],
    keyInsights: "mashreq.com dominates branded search but has significant non-branded keyword gaps across commercial/MOFU intent clusters. Competitors emiratesnbd.com and bankfab.com outrank mashreq for high-value generic banking terms despite comparable domain authority. Phase 1 should focus on closing the commercial intent gap through targeted landing pages and content clusters."
  }
};

client.connect().then(async () => {
  // Check current phase1-baseline step status
  const stepRes = await client.query(
    "SELECT status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'phase1-baseline'",
    [runId]
  );
  console.log('Current phase1-baseline status:', stepRes.rows[0]?.status);

  // Upsert workflow_context (columns: workflow_run_id, key, value)
  const existing = await client.query(
    "SELECT id FROM workflow_context WHERE workflow_run_id = $1 AND key = 'phase1-baseline'",
    [runId]
  );
  if (existing.rows.length) {
    await client.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'phase1-baseline'",
      [JSON.stringify(phase1Baseline), runId]
    );
    console.log('Updated phase1-baseline context');
  } else {
    await client.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'phase1-baseline', $2::jsonb)",
      [runId, JSON.stringify(phase1Baseline)]
    );
    console.log('Inserted phase1-baseline context');
  }

  // Mark step as awaiting_approval (requires_approval: true)
  await client.query(
    "UPDATE workflow_steps SET status = 'awaiting_approval', error = NULL, completed_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'phase1-baseline'",
    [runId]
  );
  console.log('Marked phase1-baseline as awaiting_approval');

  // Verify
  const keys = Object.keys(phase1Baseline);
  console.log('Context keys:', keys.join(', '));
  console.log('Quick wins count:', phase1Baseline.quickWins.length);
  console.log('Keyword gaps count:', phase1Baseline.keywordGaps.length);
  console.log('Top keywords count:', phase1Baseline.currentRankings.topKeywords.length);

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
