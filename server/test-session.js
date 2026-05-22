const Anthropic = require('@anthropic-ai/sdk').default;
const dotenv = require('dotenv');
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const envId = process.env.MANAGED_AGENT_ENVIRONMENT_ID;

async function testFull() {
  console.log('Creating session...');
  const session = await (client.beta).sessions.create({
    agent: 'agent_01CNd6MVXJvzcXMbgRdpfZuC',
    environment_id: envId,
    title: 'test-full'
  });
  console.log('Session created:', session.id);

  console.log('Opening stream...');
  const stream = await (client.beta).sessions.events.stream(session.id);
  console.log('Stream opened');

  console.log('Sending message...');
  await (client.beta).sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: 'Reply with just: {"status":"done"}' }] }]
  });
  console.log('Message sent, waiting for response...');

  for await (const event of stream) {
    console.log('Event:', event.type);
    if (event.type === 'session.status_idle') {
      console.log('Session idle, stop_reason:', JSON.stringify(event.stop_reason));
      break;
    }
    if (event.type === 'agent.message') {
      console.log('Response:', JSON.stringify(event.content).substring(0, 200));
    }
  }
  console.log('Done');
}

testFull().catch(e => {
  console.error('ERROR status:', e.status);
  console.error('ERROR message:', e.message);
  console.error('ERROR body:', JSON.stringify(e.error));
});
