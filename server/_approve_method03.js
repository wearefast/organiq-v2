const {Client}=require('pg');
const c=new Client({connectionString:'postgresql://pulse:pulse@localhost:5433/pulse_v2'});
c.connect().then(async()=>{
  await c.query("UPDATE workflow_steps SET status='approved',updated_at=NOW() WHERE workflow_run_id='2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' AND step_key='method03-content-gap-import'");
  const r=await c.query("SELECT step_key,status FROM workflow_steps WHERE workflow_run_id='2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' AND step_key='method03-content-gap-import'");
  console.log('Status:',r.rows[0]?.status);
  await c.end();
}).catch(e=>{console.error(e.message);c.end()});
