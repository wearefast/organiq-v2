const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
client.connect().then(async () => {
  await client.query(
    "UPDATE workflow_steps SET status = 'pending', started_at = NULL, error = NULL, updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = 'method03-content-gap-import'",
    [runId]
  );
  console.log('Reset method03-content-gap-import to pending');
  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
