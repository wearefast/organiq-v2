/**
 * fix-competitor-metrics-context.js
 * The competitor-metrics pipeline-only step completed but missed the setContext call (now fixed in code).
 * This script manually copies the step_artifacts data into workflow_context.
 */
const { Client } = require('pg');
const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  // Get latest artifact
  const a = await c.query(
    "SELECT version, data FROM step_artifacts WHERE step_key = $1 AND workflow_run_id = $2 ORDER BY version DESC LIMIT 1",
    ['competitor-metrics', RUN_ID]
  );
  if (!a.rows.length) { console.log('No artifact found'); await c.end(); return; }
  
  const { version, data } = a.rows[0];
  console.log('Using artifact v' + version, 'keys:', typeof data === 'object' ? Object.keys(data).join(', ') : 'string');

  // Check if context already exists
  const existing = await c.query(
    "SELECT jsonb_typeof(value) AS jt FROM workflow_context WHERE workflow_run_id = $1 AND key = 'competitor-metrics'",
    [RUN_ID]
  );
  
  if (existing.rows.length && existing.rows[0].jt === 'object') {
    console.log('Context already an object — skipping');
  } else if (existing.rows.length) {
    await c.query(
      "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'competitor-metrics'",
      [JSON.stringify(data), RUN_ID]
    );
    console.log('Updated context');
  } else {
    await c.query(
      "INSERT INTO workflow_context (workflow_run_id, key, value) VALUES ($1, 'competitor-metrics', $2::jsonb)",
      [RUN_ID, JSON.stringify(data)]
    );
    console.log('Inserted context');
  }

  // Show all step statuses
  const steps = await c.query(
    "SELECT step_key, status FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY step_number",
    [RUN_ID]
  );
  console.log('\nCurrent step statuses:');
  steps.rows.forEach(r => console.log(' ', r.step_key.padEnd(30), '->', r.status));

  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
