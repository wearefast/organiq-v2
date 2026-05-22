/**
 * backfill-artifacts.js
 * 
 * Copies workflow_context data → step_artifacts for steps that are empty in the UI.
 * 
 * Two cases:
 *   A) step has NO artifact row → INSERT new record using context data
 *   B) step HAS an artifact row with empty/stub data → UPDATE data from context
 * 
 * Safe to run multiple times (idempotent for case A via explicit check; for case B 
 * it will always overwrite with context data).
 */

const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const RUN = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

// All steps reported as empty by the user
const STEPS_TO_BACKFILL = [
  'ai-intelligence',
  'serp-niche-map',
  'competitor-buckets',
  'competitor-metrics',
  'method02-seed-expansion',
  'method03-content-gap-import',
  'consolidated-keywords',
  'verdict-strategy',
  'topical-map',
  'content-brief',
  'content-article',
  'content-images',
  // also fix phase1-baseline which has no artifact
  'phase1-baseline',
];

c.connect().then(async () => {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const stepKey of STEPS_TO_BACKFILL) {
    // 1. Get context data
    const ctxRes = await c.query(
      `SELECT value FROM workflow_context WHERE workflow_run_id = $1 AND key = $2`,
      [RUN, stepKey]
    );

    if (!ctxRes.rows.length) {
      console.log(`  SKIP  ${stepKey.padEnd(35)} — no workflow_context entry`);
      skipped++;
      continue;
    }

    const contextData = ctxRes.rows[0].value;

    // 2. Get the workflow_step record (need its id for FK)
    const stepRes = await c.query(
      `SELECT id FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2`,
      [RUN, stepKey]
    );

    if (!stepRes.rows.length) {
      console.log(`  SKIP  ${stepKey.padEnd(35)} — no workflow_steps record`);
      skipped++;
      continue;
    }

    const workflowStepId = stepRes.rows[0].id;

    // 3. Check if artifact already exists
    const existingRes = await c.query(
      `SELECT id, version, length(data::text) as data_len 
       FROM step_artifacts 
       WHERE workflow_run_id = $1 AND step_key = $2
       ORDER BY version DESC LIMIT 1`,
      [RUN, stepKey]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      // UPDATE: replace data with context data (context has the rich manually-injected data)
      await c.query(
        `UPDATE step_artifacts 
         SET data = $1, reasoning = $2
         WHERE id = $3`,
        [
          JSON.stringify(contextData),
          'Backfilled from workflow_context — original agent produced empty output due to 0 tool calls',
          existing.id,
        ]
      );
      console.log(`  UPDATE ${stepKey.padEnd(35)} artifact_id=${existing.id} was_len=${existing.data_len} → new_len=${JSON.stringify(contextData).length}`);
      updated++;
    } else {
      // INSERT: create new artifact record
      await c.query(
        `INSERT INTO step_artifacts (workflow_step_id, workflow_run_id, step_key, version, data, reasoning, metadata)
         VALUES ($1, $2, $3, 1, $4, $5, $6)`,
        [
          workflowStepId,
          RUN,
          stepKey,
          JSON.stringify(contextData),
          'Backfilled from workflow_context — step was manually fixed via fix script',
          JSON.stringify({
            provider: 'manual-fix',
            model: 'none',
            tokensUsed: { input: 0, output: 0, total: 0 },
            iterations: 0,
          }),
        ]
      );
      console.log(`  INSERT ${stepKey.padEnd(35)} new artifact from context (len=${JSON.stringify(contextData).length})`);
      inserted++;
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);

  // Verify
  const verifyRes = await c.query(
    `SELECT step_key, version, length(data::text) as data_len
     FROM step_artifacts 
     WHERE workflow_run_id = $1 
     ORDER BY step_key`,
    [RUN]
  );
  console.log(`\n=== ARTIFACT STATE AFTER BACKFILL ===`);
  verifyRes.rows.forEach(r => {
    console.log(`  ${r.step_key.padEnd(35)} v${r.version} len=${r.data_len}`);
  });

  await c.end();
}).catch(e => { console.error('ERROR:', e.message, e.stack); c.end(); });
