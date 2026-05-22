const { Client } = require('pg');
const { Queue } = require('bullmq');

const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';

async function main() {
  const pg = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
  await pg.connect();

  // Get org ID from run
  const runRow = await pg.query('SELECT organization_id FROM workflow_runs WHERE id = $1', [runId]);
  const orgId = runRow.rows[0].organization_id;
  console.log('Organization ID:', orgId);

  // Get pending steps with all dependencies satisfied (approved/completed)
  const stepsRes = await pg.query(
    "SELECT step_key FROM workflow_steps WHERE workflow_run_id = $1 AND status = 'pending' ORDER BY step_number",
    [runId]
  );
  const pendingSteps = stepsRes.rows.map(r => r.step_key);
  console.log('Pending steps:', pendingSteps);

  // Get approved/completed steps
  const doneRes = await pg.query(
    "SELECT step_key FROM workflow_steps WHERE workflow_run_id = $1 AND status IN ('approved','completed')",
    [runId]
  );
  const doneSteps = new Set(doneRes.rows.map(r => r.step_key));
  console.log('Done steps:', [...doneSteps]);

  // Step dependencies (copied from workflow.service.ts)
  const deps = {
    'business-profile': [],
    'seed-keywords': ['business-profile'],
    'site-audit': ['business-profile'],
    'ai-intelligence': ['site-audit'],
    'serp-niche-map': ['seed-keywords'],
    'competitor-buckets': ['serp-niche-map'],
    'competitor-metrics': ['ai-intelligence', 'competitor-buckets'],
    'search-demand': ['seed-keywords'],
    'phase1-baseline': ['competitor-metrics', 'search-demand'],
    'method01-competitor-pages': ['phase1-baseline'],
    'method02-seed-expansion': ['phase1-baseline'],
    'method03-content-gap-import': ['phase1-baseline', 'method01-competitor-pages', 'method02-seed-expansion'],
    'consolidated-keywords': ['method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import'],
    'verdict-strategy': ['consolidated-keywords'],
    'topical-map': ['verdict-strategy'],
    'content-brief': ['topical-map'],
    'content-article': ['content-brief'],
    'content-images': ['content-article'],
  };

  // Find steps eligible to enqueue (all deps satisfied)
  const eligible = pendingSteps.filter(step => {
    const stepDeps = deps[step] || [];
    return stepDeps.every(dep => doneSteps.has(dep));
  });
  console.log('Eligible to enqueue:', eligible);

  const queue = new Queue('workflow-steps', {
    connection: { host: 'localhost', port: 6379, password: 'pulsedev' },
  });

  for (const stepKey of eligible) {
    const jobId = `${runId}__${stepKey}__${Date.now()}`;
    // Mark as running in DB
    await pg.query(
      "UPDATE workflow_steps SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE workflow_run_id = $1 AND step_key = $2",
      [runId, stepKey]
    );
    await queue.add('execute-step', { workflowRunId: runId, stepKey, organizationId: orgId }, {
      jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    console.log('Enqueued:', stepKey, '→', jobId);
  }

  await queue.close();
  await pg.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
