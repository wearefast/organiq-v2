const {Client}=require('pg');
const c=new Client({connectionString:'postgresql://pulse:pulse@localhost:5433/pulse_v2'});
const RUN = process.argv[2] || 'fe089d79-f8ef-4d4c-a926-7c668f836416';

c.connect().then(async()=>{
  // Run + project
  const run = await c.query(
    `SELECT wr.id, wr.status, p.name, p.domain, p.country, p.language, p.industry
     FROM workflow_runs wr JOIN projects p ON wr.project_id = p.id WHERE wr.id = $1`, [RUN]
  );
  console.log('=== RUN / PROJECT ===');
  console.log(JSON.stringify(run.rows[0], null, 2));

  // All steps with errors
  const r = await c.query(
    `SELECT step_key, status, error FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY step_number`, [RUN]
  );
  console.log('\n=== STEPS ===');
  r.rows.forEach(row => {
    const err = row.error ? ' | ERR: ' + row.error.substring(0, 400) : '';
    console.log(`  ${row.step_key.padEnd(35)} ${row.status}${err}`);
  });

  // DLQ
  const dlq = await c.query(
    `SELECT step_key, error_message FROM dlq_failed_steps WHERE workflow_run_id = $1 ORDER BY created_at DESC LIMIT 5`, [RUN]
  ).catch(() => ({ rows: [] }));
  if (dlq.rows.length) {
    console.log('\n=== DLQ ===');
    dlq.rows.forEach(r => console.log(`  ${r.step_key}: ${r.error_message?.substring(0, 400)}`));
  }

  // Context keys
  const ctx = await c.query(`SELECT key FROM workflow_context WHERE workflow_run_id = $1 ORDER BY key`, [RUN]);
  console.log('\n=== CONTEXT KEYS ===', ctx.rows.length > 0 ? ctx.rows.map(r=>r.key).join(', ') : '(none)');

  await c.end();
}).catch(e=>{console.error(e.message);c.end()});
