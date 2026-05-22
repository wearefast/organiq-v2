const {Client}=require('pg');
const fs=require('fs');
const c=new Client({connectionString:'postgresql://pulse:pulse@localhost:5433/pulse_v2'});
c.connect().then(async()=>{
  const sql = "SELECT data FROM step_artifacts WHERE workflow_step_id=(SELECT id FROM workflow_steps WHERE workflow_run_id='2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' AND step_key='competitor-buckets') ORDER BY created_at DESC LIMIT 1";
  const r=await c.query(sql);
  if(r.rows.length) {
    fs.writeFileSync('c:\\\\Code\\\\Pulse\\\\server\\\\buckets-artifact.txt', typeof r.rows[0].data === 'object' ? JSON.stringify(r.rows[0].data, null, 2) : String(r.rows[0].data));
    console.log('written buckets-artifact.txt, type:', typeof r.rows[0].data);
  } else {
    console.log('no artifact found');
  }
  await c.end();
});
