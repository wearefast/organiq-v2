const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
client.connect().then(async () => {
  const r = await client.query(
    "UPDATE workflow_steps SET status = 'pending', error = NULL, started_at = NULL, completed_at = NULL, updated_at = NOW() WHERE workflow_run_id = $1 AND status IN ('failed', 'running') RETURNING step_key",
    [runId]
  );
  console.log('Reset steps:', r.rows.map(x => x.step_key));
  const steps = await client.query(
    'SELECT step_key, status FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY step_number',
    [runId]
  );
  steps.rows.forEach(r => console.log(r.step_key, r.status));
  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
