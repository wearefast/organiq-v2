const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5433, database: 'pulse_v2', user: 'pulse', password: 'pulse' });
const RUN_ID = 'a382773d-be63-4cdf-9cc5-65f78b51d1e1';
c.connect().then(async () => {
  const r = await c.query(
    `SELECT step_key, status, error, updated_at FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2`,
    [RUN_ID, 'method02-seed-expansion']
  );
  console.log('Step status:', JSON.stringify(r.rows));

  const r2 = await c.query(
    `SELECT version, metadata, updated_at FROM step_artifacts WHERE workflow_run_id = $1 AND step_key = $2 ORDER BY version DESC LIMIT 3`,
    [RUN_ID, 'method02-seed-expansion']
  );
  console.log('Artifacts:', JSON.stringify(r2.rows.map(x => ({ v: x.version, tokens: x.metadata?.tokensUsed, updated: x.updated_at }))));

  await c.end();
}).catch(console.error);
