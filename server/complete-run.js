const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://pulse:pulse@localhost:5433/pulse_v2' });
c.connect().then(async () => {
  await c.query(
    "UPDATE workflow_runs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756'"
  );
  const r = await c.query(
    "SELECT status, completed_at FROM workflow_runs WHERE id = '2ea63cf8-0c01-4d8d-b3d8-ae15f3867756'"
  );
  console.log('Run status:  ', r.rows[0].status);
  console.log('Completed at:', r.rows[0].completed_at);
  await c.end();
}).catch(e => { console.error(e.message); c.end(); });
