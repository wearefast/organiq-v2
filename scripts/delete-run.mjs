/**
 * Deletes a single workflow run (and its cascaded steps/artifacts/tool-calls/approvals/context).
 * Keywords, topical maps, content, and reports that reference the run have their
 * workflowRunId set to NULL (SET NULL FK) — they are NOT deleted.
 *
 * Also removes any lingering BullMQ jobs for the run from Redis.
 */
const pg = require('pg');
const Redis = require('ioredis');

const RUN_ID = 'ee03c171-1752-4302-9da6-a5b193a253f9';

const pgClient = new pg.Client({
  host: '127.0.0.1',
  port: 5433,
  user: 'pulse',
  password: 'pulse',
  database: 'pulse_v2',
});

await pgClient.connect();

// 1. Confirm the run exists before deleting
const check = await pgClient.query(
  'SELECT id, status, created_at FROM workflow_runs WHERE id = $1',
  [RUN_ID],
);
if (check.rows.length === 0) {
  console.error(`Run ${RUN_ID} not found in DB.`);
  await pgClient.end();
  process.exit(1);
}
console.log('Found run:', check.rows[0]);

// 2. Count cascaded records for the log
const stepsRes  = await pgClient.query('SELECT COUNT(*) FROM workflow_steps WHERE workflow_run_id = $1', [RUN_ID]);
const artRes    = await pgClient.query('SELECT COUNT(*) FROM step_artifacts WHERE workflow_run_id = $1', [RUN_ID]);
const ctxRes    = await pgClient.query('SELECT COUNT(*) FROM workflow_context WHERE workflow_run_id = $1', [RUN_ID]);
console.log(`  Steps: ${stepsRes.rows[0].count}, Artifacts: ${artRes.rows[0].count}, Context rows: ${ctxRes.rows[0].count}`);

// 3. Delete the run (CASCADE handles steps → approvals, tool-calls, artifacts, context)
await pgClient.query('DELETE FROM workflow_runs WHERE id = $1', [RUN_ID]);
console.log(`✓ Deleted workflow run ${RUN_ID} from DB`);

await pgClient.end();

// 4. Remove lingering BullMQ jobs from Redis
let redis;
try {
  redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    password: 'pulsedev',
  });

  // BullMQ stores jobs with keys like "bull:workflow-steps:<jobId>"
  // Jobs for this run have jobId prefix: <runId>__<stepKey>__<timestamp>
  const prefix = `bull:workflow-steps`;
  const pattern = `${prefix}:${RUN_ID}*`;

  let cursor = '0';
  let removed = 0;
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
    cursor = nextCursor;
    for (const key of keys) {
      await redis.del(key);
      removed++;
    }
  } while (cursor !== '0');

  console.log(`✓ Removed ${removed} Redis key(s) matching pattern ${pattern}`);
  await redis.quit();
} catch (err) {
  console.warn(`Redis cleanup skipped: ${err.message}`);
  if (redis) try { await redis.quit(); } catch {}
}

console.log('\nDone. Run has been fully removed.');
