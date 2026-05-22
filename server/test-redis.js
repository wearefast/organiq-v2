/**
 * Quick Redis connectivity test — uses same config as app.module.ts
 * Run: node test-redis.js
 */
const IORedis = require('ioredis');

const host = process.env.REDIS_HOST || 'localhost';
const port = parseInt(process.env.REDIS_PORT || '6379', 10);
const password = process.env.REDIS_PASSWORD || undefined;

console.log(`Connecting to Redis ${host}:${port} (password: ${password ? 'set' : 'NOT SET'})`);

const client = new IORedis({ host, port, password });

client.ping().then(res => {
  console.log('PING:', res);
  return client.keys('bull:workflow-steps:*');
}).then(keys => {
  console.log(`BullMQ workflow-steps keys count: ${keys.length}`);
  // Check if there are any waiting jobs
  return client.llen('bull:workflow-steps:wait');
}).then(waiting => {
  console.log(`Waiting jobs: ${waiting}`);
  client.quit();
}).catch(err => {
  console.error('REDIS ERROR:', err.message);
  process.exit(1);
});
