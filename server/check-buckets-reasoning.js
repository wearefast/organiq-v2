const { Client } = require('pg');
const fs = require('fs');
const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  const r = await c.query(
    "SELECT reasoning, version FROM step_artifacts WHERE step_key = $1 AND workflow_run_id = $2 ORDER BY created_at DESC LIMIT 1",
    ['competitor-buckets', RUN_ID]
  );
  if (r.rows.length) {
    const { reasoning, version } = r.rows[0];
    fs.writeFileSync('buckets-reasoning.txt', String(reasoning || ''));
    console.log('version:', version, 'reasoning length:', String(reasoning || '').length);
  } else {
    console.log('no row');
  }
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
