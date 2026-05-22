/**
 * get-ai-intelligence-context.js
 * Print the ai-intelligence step output to reconstruct JSON.
 */
const { Client } = require('pg');
const fs = require('fs');
const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  const r = await c.query(
    "SELECT value FROM workflow_context WHERE workflow_run_id = $1 AND key = $2",
    [RUN_ID, 'ai-intelligence']
  );
  if (r.rows.length) {
    const v = r.rows[0].value;
    fs.writeFileSync('ai-intelligence-context.txt', typeof v === 'string' ? v : JSON.stringify(v, null, 2));
    console.log('Saved to ai-intelligence-context.txt');
    if (typeof v === 'string') console.log('First 400 chars:', v.substring(0, 400));
  } else {
    console.log('not found');
  }
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
