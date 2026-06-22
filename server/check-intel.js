const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
const RUN = '2eef34b3-df26-4b33-b930-a0072215a268';
p.query(`
  SELECT length(pi.intelligence_context::text) as len 
  FROM project_intelligence pi 
  JOIN workflow_runs wr ON wr.project_id = pi.project_id 
  WHERE wr.id = $1
`, [RUN]).then(r => {
  console.log(r.rows);
  p.end();
}).catch(e => { console.log(e); p.end(); });
