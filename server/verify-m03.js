const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const RUN = '2eef34b3-df26-4b33-b930-a0072215a268';
p.query(
  `SELECT sa.version, LENGTH(sa.data::text) as data_len, LEFT(sa.data::text, 300) as preview
   FROM step_artifacts sa
   JOIN workflow_steps ws ON ws.id = sa.workflow_step_id
   WHERE ws.workflow_run_id = $1 AND sa.step_key = $2
   ORDER BY sa.version DESC LIMIT 1`,
  [RUN, 'method03-content-gap-import']
).then(r => {
  console.log(JSON.stringify(r.rows[0], null, 2));
  p.end();
}).catch(e => { console.error(e.message); p.end(); });
