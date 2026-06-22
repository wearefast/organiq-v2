const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

async function main() {
  const res = await pool.query(
    "SELECT key, length(value::text) as size FROM workflow_context WHERE workflow_run_id = 'a382773d-be63-4cdf-9cc5-65f78b51d1e1' ORDER BY key"
  );
  console.log('Context keys for workflow run:');
  for (const row of res.rows) {
    console.log(`  ${row.key}: ${row.size} chars`);
  }

  // Check method03 content
  const m03 = await pool.query(
    "SELECT value FROM workflow_context WHERE workflow_run_id = 'a382773d-be63-4cdf-9cc5-65f78b51d1e1' AND key = 'method03-content-gap-import'"
  );
  if (m03.rows.length > 0) {
    const val = m03.rows[0].value;
    console.log('\nMethod03 output:', JSON.stringify(val).slice(0, 500));
  } else {
    console.log('\nMethod03: NO CONTEXT ENTRY');
  }

  // Check consolidated-keywords
  const ck = await pool.query(
    "SELECT value FROM workflow_context WHERE workflow_run_id = 'a382773d-be63-4cdf-9cc5-65f78b51d1e1' AND key = 'consolidated-keywords'"
  );
  if (ck.rows.length > 0) {
    const val = ck.rows[0].value;
    const preview = JSON.stringify(val).slice(0, 500);
    console.log('\nConsolidated keywords:', preview);
  } else {
    console.log('\nConsolidated keywords: NO CONTEXT ENTRY');
  }

  // Check step statuses
  const steps = await pool.query(
    "SELECT step_key, status FROM workflow_steps WHERE workflow_run_id = 'a382773d-be63-4cdf-9cc5-65f78b51d1e1' ORDER BY position"
  );
  console.log('\nStep statuses:');
  for (const s of steps.rows) {
    console.log(`  ${s.step_key}: ${s.status}`);
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
