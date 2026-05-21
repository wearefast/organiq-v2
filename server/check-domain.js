const {Client}=require('pg');
const c=new Client({host:'127.0.0.1',port:5433,database:'pulse_v2',user:'pulse',password:'pulse'});
c.connect().then(()=>{
  return c.query("SELECT p.domain FROM projects p JOIN workflow_runs wr ON wr.project_id=p.id WHERE wr.id='e0d759aa-c81d-45d5-b202-7ade4f9b0fa0'");
}).then(r=>{
  console.log('Project domain:', JSON.stringify(r.rows));
  return c.query("SELECT key, value FROM workflow_context WHERE workflow_run_id='e0d759aa-c81d-45d5-b202-7ade4f9b0fa0' AND key='domain'");
}).then(r2=>{
  console.log('Context domain:', JSON.stringify(r2.rows));
  c.end();
}).catch(e=>{console.error(e.message);process.exit(1);});
