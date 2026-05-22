/**
 * approve-audit.js
 * Marks site-audit as approved so downstream steps become eligible.
 * Run after fix-audit-context.js has injected the structured JSON.
 */
const { Client } = require('pg');

const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

c.connect().then(async () => {
  // Check current status
  const current = await c.query(
    "SELECT id, status FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2",
    [RUN_ID, 'site-audit']
  );
  if (!current.rows.length) {
    console.log('Step not found');
    await c.end();
    return;
  }
  console.log('Current status:', current.rows[0].status);

  // Update to approved
  const res = await c.query(
    "UPDATE workflow_steps SET status = 'approved', updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = $2",
    [RUN_ID, 'site-audit']
  );
  console.log('Updated rows:', res.rowCount);

  // Show all pending steps that depend on site-audit
  const deps = await c.query(
    "SELECT step_key, status FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY created_at",
    [RUN_ID]
  );
  console.log('\nAll steps:');
  deps.rows.forEach(r => console.log(' ', r.step_key, '->', r.status));

  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
