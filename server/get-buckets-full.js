const {Client}=require('pg');
const fs=require('fs');
const c=new Client({connectionString:'postgresql://pulse:pulse@localhost:5433/pulse_v2'});
c.connect().then(async()=>{
  const r=await c.query("SELECT value FROM workflow_context WHERE workflow_run_id='2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' AND key='competitor-buckets'");
  fs.writeFileSync('buckets-full.json', JSON.stringify(r.rows[0].value, null, 2));
  console.log('written to buckets-full.json');
  await c.end();
});
