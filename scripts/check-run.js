const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 5433, user: 'pulse', password: 'pulse', database: 'pulse_v2' });

const RUN_ID = 'ee03c171-1752-4302-9da6-a5b193a253f9';

async function main() {
  const run = await pool.query(
    "SELECT id, status, current_step, started_at, created_at, updated_at FROM workflow_runs WHERE id = $1",
    [RUN_ID]
  );
  console.log('=== WORKFLOW RUN ===');
  console.log(JSON.stringify(run.rows, null, 2));

  const steps = await pool.query(
    "SELECT step_key, step_number, status, started_at, completed_at, error FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY step_number",
    [RUN_ID]
  );
  console.log('\n=== STEPS ===');
  console.log(JSON.stringify(steps.rows, null, 2));
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
