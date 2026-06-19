const { Client } = require('pg');
const Redis = require('ioredis');

const RUN_ID = 'ee03c171-1752-4302-9da6-a5b193a253f9';

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'pulse',
    password: 'pulse',
    database: 'pulse_v2',
  });
  await client.connect();

  const check = await client.query(
    'SELECT id, status, created_at FROM workflow_runs WHERE id = $1',
    [RUN_ID],
  );
  if (check.rows.length === 0) {
    console.error('Run not found:', RUN_ID);
    await client.end();
    return;
  }
  console.log('Found run:', JSON.stringify(check.rows[0]));

  const stepsRes = await client.query(
    'SELECT COUNT(*) FROM workflow_steps WHERE workflow_run_id = $1', [RUN_ID],
  );
  const artRes = await client.query(
    'SELECT COUNT(*) FROM step_artifacts WHERE workflow_run_id = $1', [RUN_ID],
  );
  const ctxRes = await client.query(
    'SELECT COUNT(*) FROM workflow_context WHERE workflow_run_id = $1', [RUN_ID],
  );
  console.log(
    'Steps:', stepsRes.rows[0].count,
    '| Artifacts:', artRes.rows[0].count,
    '| Context rows:', ctxRes.rows[0].count,
  );

  await client.query('DELETE FROM workflow_runs WHERE id = $1', [RUN_ID]);
  console.log('Deleted workflow run (cascade covers steps/artifacts/tool-calls/approvals/context)');
  await client.end();

  // Flush any lingering BullMQ Redis keys for this run
  const redis = new Redis({ host: '127.0.0.1', port: 6379, password: 'pulsedev' });
  const pattern = 'bull:workflow-steps:' + RUN_ID + '*';
  let cursor = '0';
  let removed = 0;
  do {
    const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
    cursor = result[0];
    for (const k of result[1]) {
      await redis.del(k);
      removed++;
    }
  } while (cursor !== '0');
  console.log('Removed', removed, 'Redis key(s) for this run');
  redis.disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
