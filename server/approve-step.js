/**
 * approve-step.js <step_key>
 * Approves a workflow step by key.
 * Usage: node approve-step.js consolidated-keywords
 */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const stepKey = process.argv[2];

if (!stepKey) {
  console.error('Usage: node approve-step.js <step_key>');
  process.exit(1);
}

client.connect().then(async () => {
  await client.query(
    "UPDATE workflow_steps SET status = 'approved', updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = $2",
    [runId, stepKey]
  );
  const r = await client.query(
    "SELECT step_key, status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2",
    [runId, stepKey]
  );
  console.log(`Approved ${stepKey}: ${r.rows[0]?.status}`);
  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
