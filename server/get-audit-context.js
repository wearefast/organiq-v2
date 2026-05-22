const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
c.connect().then(async () => {
  const r = await c.query(
    "SELECT value FROM workflow_context WHERE workflow_run_id = $1 AND key = $2",
    [runId, 'site-audit']
  );
  if (r.rows.length) {
    const v = r.rows[0].value;
    console.log('TYPE:', typeof v);
    console.log('VALUE:', typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  } else {
    console.log('not found');
  }
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
