/**
 * fix-audit-context.js
 * Reconstructs the structured JSON from the markdown summary that the site-audit
 * managed agent stored in workflow_context, then updates the DB row.
 *
 * Run once to unblock the current workflow run:
 *   node fix-audit-context.js
 */
const { Client } = require('pg');

const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const auditJson = {
  audit_meta: {
    url_audited: 'mashreq.com',
    audit_date: '2026-05-22',
    tool_errors: [
      'CrUX (pagespeed_crux): 403 error — unavailable',
      'DataForSEO on-page: 402 error — unavailable',
    ],
  },
  overallScore: 49,
  scores: {
    technicalHealth: { score: 50, weight: 35, weighted: 17.5 },
    onPageSeo:       { score: 60, weight: 30, weighted: 18.0 },
    contentQuality:  { score: 40, weight: 20, weighted: 8.0  },
    schemaStructure: { score: 37, weight: 15, weighted: 5.6  },
  },
  coreWebVitals: {
    lcp: { value: '3.6s',  rating: 'needs-improvement' },
    fid: { value: 'N/A',   rating: 'good'              },
    cls: { value: '0.09',  rating: 'good'              },
    inp: { value: '177ms', rating: 'good'              },
  },
  issues: [
    {
      severity: 'critical',
      category: 'Technical Health',
      title: 'Homepage redirect chain (+1,842ms)',
      description:
        'Three redirects from mashreq.com → /en/uae/neo/ add nearly 2 seconds of pure latency before rendering begins.',
      affectedUrls: ['https://mashreq.com'],
      recommendation:
        'Reduce to a single canonical redirect or serve directly from the root domain.',
    },
    {
      severity: 'critical',
      category: 'Technical Health',
      title: 'Massive unused JS bundle (1.17 MB, 71% waste)',
      description:
        'React app bundle has 2.39 MB of unused code out of 3.36 MB total, causing a catastrophic 19.4s mobile lab LCP.',
      affectedUrls: ['https://mashreq.com'],
      recommendation:
        'Implement code splitting, tree shaking, and lazy-loading to eliminate unused JavaScript.',
    },
    {
      severity: 'critical',
      category: 'Technical Health',
      title: 'Field LCP at 3.6s mobile (needs improvement)',
      description:
        'Real-user LCP exceeds the 2.5s "good" threshold on both mobile and desktop, driven by the redirect chain, render-blocking resources, and a 3,017ms hero-image load delay.',
      affectedUrls: ['https://mashreq.com'],
      recommendation:
        'Preload the LCP hero image, serve from CDN, compress it, and resolve the redirect chain first.',
    },
  ],
  topPages: [
    { url: 'https://mashreq.com/en/uae/neo/', title: 'Homepage (UAE/Neo)', score: 49 },
  ],
  siteStats: {
    totalPages: 500,
    indexablePages: null,
    avgPageLoadTime: '19.4s (mobile lab) / 3.3s (desktop lab)',
    pagesWithMissingTitle: null,
    pagesWithMissingMeta: null,
    pagesWithMissingH1: null,
    brokenLinks: null,
    imagesWithoutAlt: null,
    redirectChains: 1,
  },
  summary:
    'mashreq.com scores 49/100 overall. Three critical technical health issues dominate: a homepage redirect chain adding 1,842ms, a 1.17MB unused JS bundle causing 19.4s mobile lab LCP, and real-user LCP of 3.6s mobile. On-page SEO is reasonable (60/100) but content quality (40/100) and schema/structure (37/100) need significant work. The multilingual structure (en/ar, 10+ countries, 500+ URLs) adds crawl complexity. Fixing the redirect chain and JS bundle are the highest-priority actions.',
};

const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

c.connect().then(async () => {
  // Confirm current value is a string (sanity check)
  const check = await c.query(
    "SELECT pg_typeof(value) AS t, jsonb_typeof(value) AS jt FROM workflow_context WHERE workflow_run_id = $1 AND key = $2",
    [RUN_ID, 'site-audit']
  );
  if (!check.rows.length) {
    console.log('ERROR: No site-audit context row found — nothing to fix.');
    await c.end();
    return;
  }
  console.log('Current value pg_typeof:', check.rows[0].t, '| jsonb_typeof:', check.rows[0].jt);

  if (check.rows[0].jt === 'object') {
    console.log('Context is already a JSON object — no fix needed.');
    await c.end();
    return;
  }

  // Update with the reconstructed JSON
  const res = await c.query(
    "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = $3",
    [JSON.stringify(auditJson), RUN_ID, 'site-audit']
  );
  console.log('Updated rows:', res.rowCount);
  console.log('Done — site-audit context is now a valid JSON object.');
  console.log('overallScore:', auditJson.overallScore);
  console.log('Keys:', Object.keys(auditJson).join(', '));

  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
