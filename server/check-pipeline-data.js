const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const RUN = '2eef34b3-df26-4b33-b930-a0072215a268';
p.query("SELECT length(data::text) as len, left(data::text, 200) as preview FROM step_artifacts sa JOIN workflow_steps ws ON ws.id = sa.workflow_step_id WHERE ws.workflow_run_id = $1 AND sa.step_key = 'competitor-metrics'", [RUN]).then(r => {
  console.log(r.rows);
  p.end();
}).catch(e => { console.log(e); p.end(); });
