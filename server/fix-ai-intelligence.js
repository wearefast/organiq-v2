/**
 * fix-ai-intelligence-context.js
 * Reconstructs the ai-intelligence JSON from the markdown summary.
 * Data extracted from the managed agent's text output.
 *
 *   node fix-ai-intelligence-context.js
 */
const { Client } = require('pg');

const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const aiJson = {
  aiReadinessScore: 32,
  dimensions: {
    structuredData: {
      score: 12,
      findings: [
        'Zero Schema.org markup across the site',
        'No FAQPage, Product, or Organization structured data',
        'Homepage SPA renders schema-less content',
      ],
    },
    contentClarity: {
      score: 45,
      findings: [
        'No educational blog or financial guides content hub',
        '8 informational content gaps identified (savings rates, mortgage guides, etc.)',
        'Product pages exist but lack depth for AI comprehension',
      ],
    },
    authoritySignals: {
      score: 50,
      findings: [
        'Trustpilot rating ~2/5 — below competitor average',
        'No E-E-A-T signals (no author pages, no expert bios)',
        'UAE Central Bank regulation mentioned but not prominently signalled',
      ],
    },
    citabilityFormat: {
      score: 32,
      findings: [
        'React SPA: JS-rendered content may be invisible to AI crawlers',
        'No comparison tables or structured rate data',
        'No downloadable guides or citable reference content',
      ],
    },
    brandPresence: {
      score: 18,
      findings: [
        'Mashreq absent from 5/6 high-intent banking query AI responses',
        'No brand mentions in informational contexts (only navigational)',
        'Competitors (Emirates NBD, FAB, ADCB, RAK Bank) dominate all non-branded AI responses',
      ],
    },
  },
  aiMentions: [
    {
      query: 'best savings account UAE 2024',
      mentioned: false,
      position: 'absent',
      context: null,
    },
    {
      query: 'highest interest rate savings account UAE',
      mentioned: false,
      position: 'absent',
      context: null,
    },
    {
      query: 'top UAE banks for personal banking',
      mentioned: false,
      position: 'absent',
      context: null,
    },
    {
      query: 'UAE bank account online application',
      mentioned: false,
      position: 'absent',
      context: null,
    },
    {
      query: 'best digital bank UAE',
      mentioned: false,
      position: 'absent',
      context: null,
    },
    {
      query: 'Mashreq bank savings account',
      mentioned: true,
      position: 'featured',
      context:
        'Mashreq Bank offers the Neo savings account with 6.25% p.a. interest rate — highest in the UAE.',
    },
  ],
  opportunities: [
    {
      priority: 'high',
      title: 'Deploy Schema.org structured data',
      description:
        'Add FAQPage schema to savings and product pages, Organization schema to homepage, and BankAccount/FinancialProduct schema to key product pages.',
      expectedImpact:
        'Higher likelihood of AI model citation for savings rate queries; potential Google rich result appearances.',
    },
    {
      priority: 'high',
      title: 'Build financial education content hub',
      description:
        '8 informational content gaps identified: savings rate comparisons, mortgage guides, UAE banking regulations, expat banking, etc. No current educational content.',
      expectedImpact:
        'AI models train on educational content; hub would build authority and generate informational AI citations.',
    },
    {
      priority: 'high',
      title: 'Create competitor comparison pages',
      description:
        "Build pages like 'Mashreq vs Emirates NBD', 'Mashreq Neo vs ADCB savings' — directly targeting comparison queries where competitors dominate.",
      expectedImpact: 'Capture AI citations for comparative banking queries currently monopolised by competitors.',
    },
    {
      priority: 'medium',
      title: 'Implement server-side rendering',
      description:
        'React SPA pages may be partially invisible to AI crawlers. Server-side rendering ensures full content accessibility.',
      expectedImpact: 'All page content accessible to AI training crawlers; improved indexability overall.',
    },
  ],
  competitorComparison: [
    {
      competitor: 'Emirates NBD',
      aiReadinessEstimate: 90,
      advantage: 'Mentioned in 6/6 AI responses — dominant educational content, strong E-E-A-T, Schema.org throughout',
    },
    {
      competitor: 'FAB (First Abu Dhabi Bank)',
      aiReadinessEstimate: 80,
      advantage: 'Mentioned in 5/6 AI responses — comprehensive product pages, comparison content',
    },
    {
      competitor: 'ADCB',
      aiReadinessEstimate: 75,
      advantage: 'Mentioned in 5/6 AI responses — well-structured financial guides, strong brand content',
    },
    {
      competitor: 'RAK Bank',
      aiReadinessEstimate: 70,
      advantage: 'Mentioned in 5/6 AI responses — targeted expat and digital-first content strategy',
    },
  ],
  summary:
    "Mashreq scores 32/100 for AI readiness — critically below the competitive average (~79/100). The brand is absent from 5 of 6 AI-generated responses to high-intent banking queries; it appears only when 'Mashreq' is explicitly in the user query. Despite offering UAE's highest savings rate (6.25% p.a.), competitors with better-structured, citable content dominate AI recommendations. Root causes: zero Schema.org markup (structured data: 12/100), no informational content hub (brand presence: 18/100), JS-rendered SPA limiting AI crawler access (citability: 32/100). Prioritise Schema.org structured data deployment, a financial education hub, and competitor comparison pages to capture AI citations.",
};

const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

c.connect().then(async () => {
  const check = await c.query(
    "SELECT jsonb_typeof(value) AS jt FROM workflow_context WHERE workflow_run_id = $1 AND key = 'ai-intelligence'",
    [RUN_ID]
  );

  if (!check.rows.length) {
    // Insert new row
    await c.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'ai-intelligence', $2::jsonb)",
      [RUN_ID, JSON.stringify(aiJson)]
    );
    console.log('Inserted ai-intelligence context');
  } else if (check.rows[0].jt === 'object') {
    console.log('Already a JSON object — no fix needed.');
    await c.end();
    return;
  } else {
    await c.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'ai-intelligence'",
      [JSON.stringify(aiJson), RUN_ID]
    );
    console.log('Updated ai-intelligence context to structured JSON');
  }

  console.log('aiReadinessScore:', aiJson.aiReadinessScore);
  console.log('Keys:', Object.keys(aiJson).join(', '));

  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
