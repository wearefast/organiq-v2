const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const runId = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756';
c.connect().then(async () => {
  // Get step_artifacts schema + session ID
  const cols = await c.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'step_artifacts' ORDER BY ordinal_position"
  );
  console.log('step_artifacts columns:', cols.rows.map(r => r.column_name).join(', '));
  
  const art = await c.query(
    'SELECT * FROM step_artifacts WHERE workflow_step_id = (SELECT id FROM workflow_steps WHERE workflow_run_id = $1 AND step_key = $2) ORDER BY created_at DESC LIMIT 1',
    [runId, 'site-audit']
  );
  if (art.rows.length) {
    const row = art.rows[0];
    Object.keys(row).forEach(k => {
      const v = row[k];
      const s = typeof v === 'object' && v ? JSON.stringify(v).substring(0, 120) : String(v ?? '').substring(0, 120);
      console.log(k + ':', s);
    });
  } else {
    console.log('No artifact found');
  }
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
