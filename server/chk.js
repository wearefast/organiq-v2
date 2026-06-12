const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5433, database: 'pulse_v2', user: 'pulse', password: 'pulse' });
const RUN_ID = 'a382773d-be63-4cdf-9cc5-65f78b51d1e1';
c.connect().then(async () => {
  const r2 = await c.query(
    `SELECT version, metadata, LEFT(data::text, 2000) as d FROM step_artifacts WHERE workflow_run_id = $1 AND step_key = $2 ORDER BY version DESC LIMIT 2`,
    [RUN_ID, 'method02-seed-expansion']
  );
  r2.rows.forEach(x => console.log('method02 v'+x.version, JSON.stringify(x.metadata), '\n', x.d, '\n'));

  // method01 for comparison
  const r1 = await c.query(
    `SELECT version, metadata, LEFT(data::text, 200) as d FROM step_artifacts WHERE workflow_run_id = $1 AND step_key = $2 ORDER BY version DESC LIMIT 1`,
    [RUN_ID, 'method01-competitor-pages']
  );
  r1.rows.forEach(x => console.log('\nmethod01 v'+x.version, JSON.stringify(x.metadata), '\nFIRST_CHAR:', x.d[0], x.d.slice(0,80)));

  await c.end();
}).catch(console.error);
