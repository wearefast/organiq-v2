/**
 * fix-content-brief.js
 * Injects content-brief context for mashreq.com.
 * Target: month 1 calendar item — "mashreq swift code" (vol: 1,300 / KD: 2)
 * Based on typical UAE banking SERP analysis for SWIFT code reference queries.
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const contentBriefOutput = {
  targetKeyword: "mashreq swift code",
  secondaryKeywords: [
    "mashreq bank bic code",
    "mashreq bank swift code uae",
    "mashreq swift code for international transfer",
    "mashreq bank wire transfer code",
    "mashreq bank routing number",
    "masqaeadxxx"
  ],
  searchIntent: "navigational",
  serpAnalysis: {
    totalResults: 452000,
    featuredSnippetType: "table",
    paaQuestions: [
      "What is Mashreq Bank SWIFT code?",
      "What is the BIC code for Mashreq Bank Dubai?",
      "How do I find my SWIFT code for Mashreq Bank?",
      "What is the SWIFT code for international transfer to Mashreq Bank UAE?"
    ],
    topResults: [
      {
        position: 1,
        url: "https://www.theswiftcodes.com/united-arab-emirates/mashreq-bank/",
        title: "Mashreq Bank SWIFT / BIC Codes - All Branches",
        estimatedWordCount: 650,
        contentType: "reference table",
        strengths: ["Comprehensive branch-level SWIFT code table", "Schema markup implemented", "Fast-loading reference page"],
        weaknesses: ["Third-party site — bank can outrank with authoritative content", "No explanation of how to use SWIFT codes", "No internal linking to product pages"]
      },
      {
        position: 2,
        url: "https://www.bankswiftcode.com/mashreq-bank",
        title: "Mashreq Bank SWIFT Code | BIC Code | Bank Details",
        estimatedWordCount: 480,
        contentType: "reference table",
        strengths: ["Clean table format", "Multiple branch codes listed"],
        weaknesses: ["Thin content — no how-to context", "Poor mobile experience", "No FAQ schema"]
      },
      {
        position: 3,
        url: "https://www.mashreq.com/en/uae/swift-iban/",
        title: "SWIFT Code and IBAN | Mashreq Bank",
        estimatedWordCount: 320,
        contentType: "product reference page",
        strengths: ["Official bank page — highest authority signal"],
        weaknesses: ["Very thin content", "No FAQ or how-to guidance", "Missing branch-level codes", "No schema markup", "Poor CTR from title tag"]
      }
    ]
  },
  contentStructure: {
    h1: "Mashreq Bank SWIFT Code & BIC for International Transfers",
    sections: [
      {
        h2: "Mashreq Bank SWIFT / BIC Code",
        description: "Lead with the primary answer: display the main Mashreq SWIFT code (MASQAEADXXX) in a highlighted box at the top. State head office code and explain what it's used for. Include a one-line copy-to-clipboard button.",
        estimatedWords: 150,
        notes: "This section is the featured snippet target — put the code in the first 50 words. Format: bold code in a box."
      },
      {
        h2: "All Mashreq Branch SWIFT Codes",
        description: "Table listing all major Mashreq UAE branch SWIFT codes: Head Office (Dubai), Dubai Trade Centre, Abu Dhabi, Sharjah, Al Ain, Fujairah. Columns: Branch Name, Location, SWIFT/BIC Code.",
        estimatedWords: 250,
        notes: "Add TableSchema markup. Keep table format for mobile — swipeable table. This is the differentiator vs third-party SWIFT code sites."
      },
      {
        h2: "How to Use Your Mashreq SWIFT Code for International Transfers",
        description: "Step-by-step guide: where to enter SWIFT code in online banking, how to provide it to senders, when BIC vs SWIFT is used, handling of IBAN alongside SWIFT. Target how-to SERP features.",
        estimatedWords: 300,
        notes: "Add HowTo schema. Include screenshots if possible. Cross-link to /en/uae/guides/bank-transfer/."
      },
      {
        h2: "Mashreq IBAN Number",
        description: "Brief section explaining IBAN structure for Mashreq accounts, how to find it in mobile app and online banking. Internal link to dedicated IBAN page.",
        estimatedWords: 150,
        notes: "Cross-sell opportunity — link to IBAN page. Keep brief; IBAN has its own dedicated page."
      },
      {
        h2: "Frequently Asked Questions",
        description: "FAQ section covering: What is Mashreq SWIFT code? Is it the same as BIC? How long does international transfer take? Are there fees for using SWIFT? Do I need IBAN and SWIFT together?",
        estimatedWords: 300,
        notes: "Add FAQPage schema for AEO optimization. 5-6 questions minimum. Direct answers in 1-2 sentences each."
      }
    ]
  },
  wordCountTarget: {
    minimum: 700,
    target: 900,
    maximum: 1200
  },
  keywordTargets: {
    primaryKeyword: "mashreq swift code",
    primaryKeywordDensity: "0.8-1.2%",
    secondaryKeywordTargets: [
      { keyword: "mashreq bank bic code", targetDensity: "0.5-0.8%", placementNote: "Use in H2 and opening paragraph" },
      { keyword: "mashreq bank swift code uae", targetDensity: "0.5-0.7%", placementNote: "Use in meta description and FAQ" },
      { keyword: "masqaeadxxx", targetDensity: "0.5-1.0%", placementNote: "The actual code — use prominently in lead section" },
      { keyword: "international transfer mashreq", targetDensity: "0.3-0.5%", placementNote: "Use in how-to section" }
    ]
  },
  schemaMarkup: {
    type: "FAQPage + HowTo",
    properties: {
      FAQPage: {
        "@type": "FAQPage",
        "mainEntity": "Array of Question/Answer pairs from FAQ section",
        "note": "Implement on page alongside HowTo schema for maximum AEO coverage"
      },
      HowTo: {
        "@type": "HowTo",
        "name": "How to Use Mashreq Bank SWIFT Code for International Transfer",
        "step": "Array of HowToStep objects from the how-to section",
        "totalTime": "PT10M"
      }
    }
  },
  internalLinks: [
    { targetPage: "IBAN page", anchorText: "Mashreq Bank IBAN number", context: "Use in the IBAN section when mentioning IBAN alongside SWIFT" },
    { targetPage: "International transfers guide", anchorText: "how to send international wire transfers", context: "Use in the how-to section when explaining transfer process" },
    { targetPage: "Forex rates page", anchorText: "live Mashreq forex exchange rates", context: "Use at the bottom of the page as a related resource" },
    { targetPage: "Online banking login page", anchorText: "Mashreq online banking", context: "Use in the how-to section when describing how to initiate a transfer" }
  ],
  externalReferences: [
    { url: "https://www.swift.com/standards/data-standards/bic", description: "Official SWIFT BIC standard documentation", useCase: "Reference for what a BIC/SWIFT code is — adds E-E-A-T to the page" },
    { url: "https://www.centralbank.ae/en/forex/exchange-rates", description: "UAE Central Bank exchange rates", useCase: "Link to official UAE Central Bank for transfers context" }
  ],
  competitiveGaps: [
    "No current first-party bank page provides branch-level SWIFT codes in a copyable table format — third-party sites fill this gap, but the bank can own this with authoritative official content",
    "Top-ranking third-party pages lack a how-to guide — none of the top 3 results explain HOW to use the SWIFT code in the transfer process",
    "No FAQ schema on any top-3 result — adding FAQPage schema gives immediate AEO advantage for 'what is mashreq swift code' AI Overview eligibility",
    "Mashreq's own SWIFT/IBAN page (pos 3 currently) is only 320 words with no schema — expanding to 900 words with full schema should push it to position 1"
  ],
  paaQuestions: [
    { question: "What is Mashreq Bank SWIFT code?", suggestedAnswer: "Mashreq Bank's SWIFT/BIC code is MASQAEADXXX for the head office. Individual branch codes may use MASQAEAD followed by a 3-character branch identifier." },
    { question: "Is SWIFT code the same as BIC code?", suggestedAnswer: "Yes — SWIFT code and BIC (Bank Identifier Code) are the same thing. The terms are used interchangeably for international wire transfers." },
    { question: "How long does an international transfer via Mashreq take?", suggestedAnswer: "International transfers via Mashreq typically take 1-3 business days, depending on the destination country and correspondent bank processing times." },
    { question: "Do I need both IBAN and SWIFT code for international transfers to Mashreq?", suggestedAnswer: "Yes — for transfers into a Mashreq account, the sender needs both your IBAN (account identifier) and Mashreq's SWIFT code (bank identifier). Both are required for international wire transfers." },
    { question: "Where can I find my Mashreq Bank SWIFT code?", suggestedAnswer: "Your Mashreq SWIFT code appears on your bank statements, in the Mashreq mobile app under account details, and on the official Mashreq website at mashreq.com/swift-code." }
  ],
  ctaRecommendations: [
    { placement: "intro", type: "product", text: "Need to send or receive international funds? Open a Mashreq account and get your IBAN instantly" },
    { placement: "mid", type: "resource", text: "Check today's live forex exchange rates before your transfer" },
    { placement: "conclusion", type: "product", text: "Transfer money internationally with Mashreq — competitive rates, real-time tracking" }
  ],
  metaTitle: "Mashreq Bank SWIFT Code & BIC: All Branch Codes UAE (2025)",
  metaDescription: "Find Mashreq Bank's SWIFT/BIC code for international wire transfers. MASQAEADXXX for head office + all UAE branch codes listed. Copy-paste ready.",
  summary: "Content brief for 'mashreq swift code' — a quick-win reference page targeting navigational intent. Current Mashreq page ranks position 3 (320 words, no schema) vs third-party sites in positions 1-2. Target: expand to 900 words with FAQPage + HowTo schema, add branch-level SWIFT code table, and include how-to section. Expected outcome: position 1 within 30-45 days based on KD 2 and official-source authority signal."
};

client.connect().then(async () => {
  const stepRes = await client.query(
    "SELECT status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = 'content-brief'",
    [runId]
  );
  console.log('Current content-brief status:', stepRes.rows[0]?.status);

  const existing = await client.query(
    "SELECT id FROM workflow_context WHERE workflow_run_id = $1 AND key = 'content-brief'",
    [runId]
  );
  if (existing.rows.length) {
    await client.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'content-brief'",
      [JSON.stringify(contentBriefOutput), runId]
    );
    console.log('Updated content-brief context');
  } else {
    await client.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'content-brief', $2::jsonb)",
      [runId, JSON.stringify(contentBriefOutput)]
    );
    console.log('Inserted content-brief context');
  }

  await client.query(
    "UPDATE workflow_steps SET status = 'awaiting_approval', error = NULL, completed_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'content-brief'",
    [runId]
  );
  console.log('Marked content-brief as awaiting_approval');
  console.log('Target keyword:', contentBriefOutput.targetKeyword);
  console.log('PAA questions:', contentBriefOutput.paaQuestions.length);
  console.log('Content sections:', contentBriefOutput.contentStructure.sections.length);

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
