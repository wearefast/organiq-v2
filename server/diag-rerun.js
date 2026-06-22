const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

async function main() {
  // Get all seed-keywords artifacts (to see if a new version was created)
  const artifacts = await pool.query(
    `SELECT sa.step_key, sa.version, LEFT(sa.data::text, 3000) as data_preview, sa.created_at
     FROM step_artifacts sa
     JOIN workflow_steps ws ON ws.id = sa.workflow_step_id
     WHERE ws.workflow_run_id = '2eef34b3-df26-4b33-b930-a0072215a268'
       AND sa.step_key = 'seed-keywords'
     ORDER BY sa.version DESC`
  );
  console.log('=== All Seed Keywords Artifacts ===');
  for (const a of artifacts.rows) {
    console.log(`Version ${a.version} (${a.created_at}):`);
    console.log(a.data_preview.substring(0, 500));
    console.log('---');
  }

  // Check step status
  const steps = await pool.query(
    `SELECT step_key, status, error, updated_at FROM workflow_steps
     WHERE workflow_run_id = '2eef34b3-df26-4b33-b930-a0072215a268'
       AND step_key = 'seed-keywords'`
  );
  console.log('\n=== Step Status ===');
  console.log(JSON.stringify(steps.rows, null, 2));

  // Check workflow context for seed-keywords
  const ctx = await pool.query(
    `SELECT LEFT(value::text, 1000) as val FROM workflow_context
     WHERE workflow_run_id = '2eef34b3-df26-4b33-b930-a0072215a268'
       AND key = 'seed-keywords'`
  );
  console.log('\n=== Context seed-keywords ===');
  console.log(ctx.rows[0]?.val);

  await pool.end();
}
main().catch(e => { console.error(e); pool.end(); });
