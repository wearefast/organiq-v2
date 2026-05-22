const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

async function main() {
  await client.connect();

  const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  );
  console.log('All tables:', tables.rows.map(t => t.table_name).join(', '));

  // Check project + context
  const proj = await client.query(
    'SELECT p.id, p.name, p.domain, p.country, p.language, p.industry FROM workflow_runs wr JOIN projects p ON wr.project_id = p.id WHERE wr.id = $1',
    [runId]
  );
  console.log('Project:', JSON.stringify(proj.rows[0], null, 2));

  const ctx = await client.query(
    'SELECT * FROM workflow_context WHERE workflow_run_id = $1',
    [runId]
  ).catch(e => { console.log('context error:', e.message); return { rows: [] }; });
  console.log('Context entries:', ctx.rows.length, ctx.rows.map(r => r.key + '=' + JSON.stringify(r.value)).join(', '));

  const run = await client.query(
    'SELECT id, status FROM workflow_runs WHERE id = $1',
    [runId]
  );
  console.log('Run:', JSON.stringify(run.rows[0]));

  // DON'T auto-reset failed steps — just show them
  const steps = await client.query(
    'SELECT step_key, status, error FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY step_number',
    [runId]
  );
  steps.rows.forEach(r => {
    const err = r.error ? ' ERROR: ' + r.error.substring(0, 200) : '';
    console.log(r.step_key, r.status + err);
  });

  await client.end();
}

main().catch(e => { console.error(e.message); client.end(); });
