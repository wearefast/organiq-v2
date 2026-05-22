/**
 * fix-buckets.js
 * Restores workflow_context for competitor-buckets from the v1 step artifact
 * (which has the full competitor array, not just counts).
 */
const { Client } = require('pg');
const fs = require('fs');

const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });

c.connect().then(async () => {
  // Get v1 artifact data
  const r = await c.query(
    "SELECT data FROM step_artifacts WHERE step_key = $1 AND workflow_run_id = $2 AND version = 1",
    ['competitor-buckets', RUN_ID]
  );
  if (!r.rows.length) {
    console.log('ERROR: No v1 artifact found');
    await c.end();
    return;
  }

  const v1 = r.rows[0].data;
  console.log('v1 keys:', Object.keys(v1).join(', '));
  if (v1?.buckets?.direct?.competitors) {
    console.log('direct competitors:', Array.isArray(v1.buckets.direct.competitors)
      ? v1.buckets.direct.competitors.map(c => c.domain).join(', ')
      : v1.buckets.direct.competitors);
  }

  // Update workflow_context with v1 data
  const upd = await c.query(
    "UPDATE workflow_context SET value = $1::jsonb WHERE workflow_run_id = $2 AND key = 'competitor-buckets'",
    [JSON.stringify(v1), RUN_ID]
  );
  console.log('Updated rows:', upd.rowCount);
  console.log('Done — competitor-buckets context restored from v1 artifact');

  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
