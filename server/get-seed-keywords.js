/**
 * get-seed-keywords.js
 * Print the full seed-keywords context to understand available keyword data.
 */
const { Client } = require('pg');
const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  const r = await c.query(
    "SELECT value FROM workflow_context WHERE workflow_run_id = $1 AND key = $2",
    [RUN_ID, 'seed-keywords']
  );
  if (r.rows.length) {
    const v = r.rows[0].value;
    // Print structure summary
    console.log('Top-level keys:', Object.keys(v).join(', '));
    if (v.seedKeywords) {
      console.log('seedKeywords count:', v.seedKeywords.length);
      console.log('First 3 seedKeywords:', JSON.stringify(v.seedKeywords.slice(0, 3), null, 2));
    }
    if (v.topOpportunities) {
      console.log('topOpportunities count:', v.topOpportunities.length);
      console.log('First 2:', JSON.stringify(v.topOpportunities.slice(0, 2), null, 2));
    }
    // Print full JSON for reference
    const fs = require('fs');
    fs.writeFileSync('seed-keywords-context.json', JSON.stringify(v, null, 2));
    console.log('\nFull context saved to seed-keywords-context.json');
  }
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
