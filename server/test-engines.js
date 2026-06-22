// Direct engine test — bypasses queue
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

console.log('OPENAI_KEY:', OPENAI_KEY ? `sk-...${OPENAI_KEY.slice(-6)}` : 'MISSING');
console.log('ANTHROPIC_KEY:', ANTHROPIC_KEY ? `sk-ant-...${ANTHROPIC_KEY.slice(-6)}` : 'MISSING');
console.log('PERPLEXITY_KEY:', PERPLEXITY_KEY ? `pplx-...${PERPLEXITY_KEY.slice(-6)}` : 'MISSING');
console.log('');

const PROMPT = 'Best banks in UAE for individuals';

async function testOpenAI() {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-search-preview',
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.log('[OpenAI] ERROR', r.status, body.slice(0, 200));
      return;
    }
    const d = await r.json();
    const text = d.choices?.[0]?.message?.content ?? '';
    console.log('[OpenAI] OK — first 200 chars:', text.slice(0, 200));
  } catch (e) {
    console.log('[OpenAI] EXCEPTION:', e.message);
  }
}

async function testClaude() {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.log('[Claude] ERROR', r.status, body.slice(0, 300));
      return;
    }
    const d = await r.json();
    const text = d.content?.filter(b => b.type === 'text').map(b => b.text ?? '').join('') ?? '';
    console.log('[Claude] OK — first 200 chars:', text.slice(0, 200));
  } catch (e) {
    console.log('[Claude] EXCEPTION:', e.message);
  }
}

async function testPerplexity() {
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: PROMPT }],
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      console.log('[Perplexity] ERROR', r.status, body.slice(0, 200));
      return;
    }
    const d = await r.json();
    const text = d.choices?.[0]?.message?.content ?? '';
    console.log('[Perplexity] OK — first 200 chars:', text.slice(0, 200));
  } catch (e) {
    console.log('[Perplexity] EXCEPTION:', e.message);
  }
}

(async () => {
  console.log('Testing OpenAI...');
  await testOpenAI();
  console.log('\nTesting Claude...');
  await testClaude();
  console.log('\nTesting Perplexity...');
  await testPerplexity();
  console.log('\nDone.');
})();
