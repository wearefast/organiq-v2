/**
 * check-step.js <step-key>
 * Quick diagnostic for any step's status and error.
 */
// check-step.js — parameterized via RUN env var or hardcoded
const { Client } = require('pg');

const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const stepKey = process.argv[2] || 'search-demand';

const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

c.connect().then(async () => {
  const r = await c.query(
    'SELECT step_key, status, error, started_at, completed_at FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2',
    [RUN_ID, stepKey]
  );
  if (!r.rows.length) { console.log('Step not found'); await c.end(); return; }
  const s = r.rows[0];
  console.log('Step:', s.step_key);
  console.log('Status:', s.status);
  console.log('Started:', s.started_at);
  console.log('Completed:', s.completed_at);
  console.log('Error:', s.error || '(none)');

  const tc = await c.query(
    'SELECT COUNT(*) AS cnt FROM step_tool_calls WHERE workflow_step_id = (SELECT id FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2)',
    [RUN_ID, stepKey]
  );
  console.log('Tool calls:', tc.rows[0].cnt);

  const ctx = await c.query(
    "SELECT jsonb_typeof(value) AS jt, left(value::text, 200) AS preview FROM workflow_context WHERE workflow_run_id = $1 AND key = $2",
    [RUN_ID, stepKey]
  );
  if (ctx.rows.length) {
    console.log('Context type:', ctx.rows[0].jt);
    console.log('Context preview:', ctx.rows[0].preview);
  } else {
    console.log('Context: (not stored yet)');
  }

  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
