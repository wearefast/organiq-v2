const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const RUN = '2eef34b3-df26-4b33-b930-a0072215a268';
p.query("SELECT sa.metadata FROM step_artifacts sa JOIN workflow_steps ws ON ws.id = sa.workflow_step_id WHERE ws.workflow_run_id = $1 AND sa.step_key = 'method03-content-gap-import' ORDER BY sa.version DESC LIMIT 1", [RUN]).then(r => {
  console.log(JSON.stringify(r.rows[0].metadata, null, 2));
  p.end();
}).catch(e => { console.log(e); p.end(); });
