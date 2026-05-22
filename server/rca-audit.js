const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const RUN = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

c.connect().then(async () => {
  // 1. Check step_artifacts table existence and row counts per step
  const tablesRes = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  console.log('=== TABLES ===');
  console.log(tablesRes.rows.map(r => r.table_name).join(', '));

  // 2. Check step_artifacts schema
  const artifactCols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'step_artifacts' ORDER BY ordinal_position
  `);
  console.log('\n=== step_artifacts COLUMNS ===');
  artifactCols.rows.forEach(r => console.log(' ', r.column_name, ':', r.data_type));

  // 3. Count artifacts per step for this run
  const artifactCounts = await c.query(`
    SELECT step_key, count(*) as cnt, max(version) as max_ver
    FROM step_artifacts WHERE workflow_run_id = $1
    GROUP BY step_key ORDER BY step_key
  `, [RUN]);
  console.log('\n=== ARTIFACTS PER STEP ===');
  if (artifactCounts.rows.length === 0) {
    console.log('  *** NO ARTIFACTS FOUND FOR THIS RUN ***');
  } else {
    artifactCounts.rows.forEach(r => console.log(`  ${r.step_key.padEnd(35)} rows:${r.cnt} max_ver:${r.max_ver}`));
  }

  // 4. Check workflow_context keys for this run
  const ctxKeys = await c.query(`
    SELECT key, jsonb_typeof(value) as type, length(value::text) as val_len
    FROM workflow_context WHERE workflow_run_id = $1 ORDER BY key
  `, [RUN]);
  console.log('\n=== WORKFLOW_CONTEXT KEYS ===');
  ctxKeys.rows.forEach(r => console.log(`  ${r.key.padEnd(35)} type:${r.type} len:${r.val_len}`));

  // 5. Sample what data is in ai-intelligence context
  const aiCtx = await c.query(`
    SELECT value FROM workflow_context WHERE workflow_run_id = $1 AND key = 'ai-intelligence'
  `, [RUN]);
  if (aiCtx.rows.length) {
    const v = aiCtx.rows[0].value;
    const keys = typeof v === 'object' ? Object.keys(v).slice(0, 10) : 'not object';
    console.log('\n=== ai-intelligence context top-level keys ===');
    console.log(' ', keys);
  } else {
    console.log('\n=== ai-intelligence context: NOT FOUND ===');
  }

  // 6. Check if any step has artifacts at all for any run (sanity check table)
  const allArtifacts = await c.query(`SELECT count(*) as total FROM step_artifacts`);
  console.log('\n=== TOTAL step_artifacts rows (all runs) ===', allArtifacts.rows[0].total);

  // 7. Check workflow_steps output_data column if exists
  const stepCols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'workflow_steps' ORDER BY ordinal_position
  `);
  console.log('\n=== workflow_steps COLUMNS ===');
  stepCols.rows.forEach(r => console.log(' ', r.column_name, ':', r.data_type));

  // 8. Check if workflow_steps has any output/result column populated
  const stepData = await c.query(`
    SELECT step_key, status FROM workflow_steps
    WHERE workflow_run_id = $1 ORDER BY step_number
  `, [RUN]);
  console.log('\n=== STEP STATUSES ===');
  stepData.rows.forEach(r => console.log(`  ${r.step_key.padEnd(35)} ${r.status}`));

  await c.end();
}).catch(e => { console.error('ERROR:', e.message); c.end(); });
