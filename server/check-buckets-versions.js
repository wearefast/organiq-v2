const { Client } = require('pg');
const fs = require('fs');
const RUN_ID = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  // Get ALL versions of competitor-buckets artifact
  const r = await c.query(
    "SELECT version, created_at, data FROM step_artifacts WHERE step_key = $1 AND workflow_run_id = $2 ORDER BY version ASC",
    ['competitor-buckets', RUN_ID]
  );
  console.log('Found versions:', r.rows.map(r => `v${r.version} (${r.created_at})`).join(', '));
  for (const row of r.rows) {
    const d = row.data;
    const txt = typeof d === 'object' ? JSON.stringify(d, null, 2) : String(d || '');
    fs.writeFileSync(`buckets-v${row.version}.json`, txt);
    console.log(`v${row.version}: length=${txt.length}, keys=${typeof d === 'object' && d ? Object.keys(d).join(',') : 'string'}`);
    // If it has full competitor data, show a sample
    if (typeof d === 'object' && d?.buckets?.direct?.competitors && Array.isArray(d.buckets.direct.competitors)) {
      console.log('  FULL DATA! direct competitors:', d.buckets.direct.competitors.map(c => c.domain).join(', '));
    }
  }
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
