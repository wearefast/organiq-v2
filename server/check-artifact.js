const { Client } = require('pg');

const RUN = process.argv[2] || 'cfeeea48-ba75-49b2-8a89-bf7580c9d8f9';
const STEP = process.argv[3] || 'business-profile';

async function main() {
  const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
  await c.connect();

  const r = await c.query(
    `SELECT sa.data, sa.reasoning, sa.metadata
     FROM step_artifacts sa
     JOIN workflow_steps ws ON sa.workflow_step_id = ws.id
     WHERE ws.workflow_run_id = $1 AND ws.step_key = $2
     ORDER BY sa.version DESC LIMIT 1`,
    [RUN, STEP]
  );

  if (r.rows.length) {
    const { data, reasoning, metadata } = r.rows[0];
    console.log('=== ARTIFACT DATA ===');
    console.log('Type:', typeof data);
    if (typeof data === 'object' && data) {
      console.log('Top keys:', Object.keys(data).join(', '));
      console.log('Preview:', JSON.stringify(data, null, 2).slice(0, 500));
    } else {
      console.log('Value:', String(data).slice(0, 200));
    }
    console.log('\n=== METADATA ===');
    console.log(JSON.stringify(metadata, null, 2));
    console.log('\n=== REASONING (first 300 chars) ===');
    console.log(reasoning ? reasoning.slice(0, 300) : 'null');
  } else {
    console.log('No artifact found');
  }

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
