/**
 * One-off script: create a new workflow run and enqueue business-profile step.
 * Run with: node scripts/create-test-run.js
 * 
 * Does NOT use HTTP auth — bypasses Clerk guard entirely.
 */
'use strict';

const { Pool } = require('pg');
const { Queue } = require('bullmq');
const { createClient } = require('ioredis');

// ─── Config ──────────────────────────────────────────────────
const DATABASE_URL = 'postgresql://pulse:pulse@localhost:5433/pulse_v2';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const PROJECT_ID = 'd8232c75-07b3-4c0a-b2d4-81e1c7821043';
const ORG_ID = 'a10ac612-874c-4376-8e3b-a9bc12523fbf';

// Step definitions matching workflow.service.ts STEP_DEFINITIONS
const STEP_DEFINITIONS = [
  ['business-profile', 1, 1, []],
  ['seed-keywords', 2, 1, ['business-profile']],
  ['site-audit', 3, 1, ['business-profile']],
  ['ai-intelligence', 4, 1, ['site-audit']],
  ['serp-niche-map', 5, 1, ['seed-keywords']],
  ['competitor-buckets', 6, 1, ['serp-niche-map']],
  ['competitor-metrics', 7, 1, ['ai-intelligence', 'competitor-buckets']],
  ['search-demand', 8, 1, ['seed-keywords']],
  ['phase1-baseline', 9, 2, ['competitor-metrics', 'search-demand']],
  ['method01-competitor-pages', 10, 2, ['phase1-baseline']],
  ['method02-seed-expansion', 11, 2, ['phase1-baseline']],
  ['method03-content-gap-import', 12, 2, ['phase1-baseline']],
  ['consolidated-keywords', 13, 2, ['method01-competitor-pages', 'method02-seed-expansion', 'method03-content-gap-import']],
  ['verdict-strategy', 14, 3, ['consolidated-keywords']],
  ['topical-map', 15, 3, ['verdict-strategy']],
  ['content-brief', 16, 4, ['topical-map']],
  ['content-article', 17, 4, ['content-brief']],
  ['content-images', 18, 4, ['content-article']],
];

async function main() {
  // ─── DB connection ──────────────────────────────────────────
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the workflow run
    const runResult = await client.query(
      `INSERT INTO workflow_runs (project_id, organization_id, status, created_at, updated_at)
       VALUES ($1, $2, 'draft', NOW(), NOW())
       RETURNING id`,
      [PROJECT_ID, ORG_ID],
    );
    const runId = runResult.rows[0].id;
    console.log(`Created workflow run: ${runId}`);

    // 2. Create all 18 step records (pending)
    for (const [stepKey, stepNumber, phase] of STEP_DEFINITIONS) {
      await client.query(
        `INSERT INTO workflow_steps (workflow_run_id, step_key, step_number, phase, status, iterations, credits_used, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', 0, 0, NOW(), NOW())`,
        [runId, stepKey, stepNumber, phase],
      );
    }
    console.log(`Created ${STEP_DEFINITIONS.length} step records`);

    // 3. Get project domain for context
    const projResult = await client.query(
      'SELECT domain, country, language, industry FROM projects WHERE id = $1',
      [PROJECT_ID],
    );
    const project = projResult.rows[0];
    console.log(`Project domain: ${project.domain}`);

    // 4. Set workflow context (value column is jsonb — stringify the values)
    const contextEntries = [
      ['domain', project.domain || ''],
      ['country', project.country || ''],
      ['language', project.language || 'en'],
      ['industry', project.industry || ''],
    ];
    for (const [key, value] of contextEntries) {
      await client.query(
        `INSERT INTO workflow_context (workflow_run_id, key, value, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (workflow_run_id, key) DO UPDATE SET value = $3::jsonb, updated_at = NOW()`,
        [runId, key, JSON.stringify(value)],
      );
    }

    // 5. Mark run as running, mark business-profile step as running
    await client.query(
      `UPDATE workflow_runs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [runId],
    );
    await client.query(
      `UPDATE workflow_steps SET status = 'running', started_at = NOW(), updated_at = NOW()
       WHERE workflow_run_id = $1 AND step_key = 'business-profile'`,
      [runId],
    );

    await client.query('COMMIT');
    console.log(`Run ${runId} committed, business-profile marked running`);

    // 6. Enqueue business-profile via BullMQ
    const queue = new Queue('workflow-steps', {
      connection: { host: 'localhost', port: 6379 },
    });

    const jobId = `${runId}__business-profile__${Date.now()}`;
    await queue.add('execute-step', {
      workflowRunId: runId,
      stepKey: 'business-profile',
      organizationId: ORG_ID,
    }, { jobId });

    console.log(`Enqueued business-profile job: ${jobId}`);
    console.log(`\n✅ Done! Run ID: ${runId}`);
    console.log(`Monitor at: http://localhost:3001 (select this run)`);

    await queue.close();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

main();
