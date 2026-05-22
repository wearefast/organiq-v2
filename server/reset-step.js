const { Client } = require('pg');
const { Queue } = require('bullmq');

const RUN = process.argv[2] || 'cfeeea48-ba75-49b2-8a89-bf7580c9d8f9';
const STEP = process.argv[3] || 'business-profile';

async function main() {
  const pg = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
  await pg.connect();

  // Reset step
  await pg.query(
    `UPDATE workflow_steps SET status='pending', error=NULL, started_at=NULL, completed_at=NULL, updated_at=NOW()
     WHERE workflow_run_id=$1 AND step_key=$2`,
    [RUN, STEP]
  );
  console.log(`Reset ${STEP} to pending`);

  // Get org ID
  const orgRes = await pg.query('SELECT organization_id FROM workflow_runs WHERE id=$1', [RUN]);
  const orgId = orgRes.rows[0].organization_id;

  // Mark as running
  await pg.query(
    `UPDATE workflow_steps SET status='running', started_at=NOW(), updated_at=NOW()
     WHERE workflow_run_id=$1 AND step_key=$2`,
    [RUN, STEP]
  );

  // Enqueue
  const q = new Queue('workflow-steps', { connection: { host: 'localhost', port: 6379, password: 'pulsedev' } });
  const jobId = `${RUN}__${STEP}__${Date.now()}`;
  await q.add('execute-step', { workflowRunId: RUN, stepKey: STEP, organizationId: orgId }, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  console.log(`Enqueued ${STEP} → ${jobId}`);

  await q.close();
  await pg.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
