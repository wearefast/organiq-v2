const {Client}=require('pg');
const c=new Client({connectionString:'postgresql://pulse:pulse@localhost:5433/pulse_v2'});
c.connect().then(async()=>{
  const r=await c.query("SELECT value::text as v FROM workflow_context WHERE workflow_run_id='2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' AND key='ai-intelligence'");
  const fs=require('fs');
  fs.writeFileSync('c:\\Code\\Pulse\\server\\ai-ctx.txt', r.rows[0].v);
  console.log('wrote ai-ctx.txt');
  await c.end();
}).catch(e=>{console.error(e.message);c.end();});