const {Client}=require('./node_modules/pg');
const c=new Client({connectionString:'postgresql://pulse:pulse@localhost:5433/pulse_v2'});
c.connect().then(async()=>{
  const r=await c.query("SELECT value FROM workflow_context WHERE workflow_run_id='2ea63cf8-0c01-4d8d-b3d8-ae15f3867756' AND key='competitor-buckets'");
  if(r.rows[0]) {
    const v=r.rows[0].value;
    console.log('Top keys:', Object.keys(v).join(', '));
    if(v.buckets) {
      console.log('bucket keys:', Object.keys(v.buckets).join(', '));
      if(v.buckets.direct) console.log('direct.competitors type:', Array.isArray(v.buckets.direct.competitors), 'count:', v.buckets.direct.competitors?.length);
      if(v.buckets.content) console.log('content.competitors type:', Array.isArray(v.buckets.content.competitors), 'count:', v.buckets.content.competitors?.length);
    }
    if(v.competitors) console.log('TOP-LEVEL competitors:', Array.isArray(v.competitors), JSON.stringify(v.competitors).substring(0,200));
  }
  await c.end();
});
