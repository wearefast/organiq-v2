// final-check.js — rewritten without tool_calls column
const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='workflow_steps'");
  console.log('columns:', cols.rows.map(r=>r.column_name).join(', '));
  const steps = await c.query("SELECT step_key, status FROM workflow_steps WHERE workflow_run_id = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' ORDER BY step_number");
  console.log('\n=== STEP STATUS ===');
  steps.rows.forEach(r => console.log(r.step_key.padEnd(35) + ' ' + r.status));
  const run = await c.query("SELECT status, completed_at FROM workflow_runs WHERE id = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756'");
  console.log('\n=== WORKFLOW RUN ===');
  console.log('Run status:', run.rows[0]?.status);
  console.log('Completed at:', run.rows[0]?.completed_at);
  const pending = steps.rows.filter(r => !['approved','completed'].includes(r.status));
  console.log('\nSteps NOT done:', pending.length === 0 ? 'NONE � all complete!' : pending.map(r => r.step_key + ' (' + r.status + ')').join(', '));
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
