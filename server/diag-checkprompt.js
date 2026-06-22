// Diagnostic: replicate checkPrompt step-by-step with full logging
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { Client } = require('./node_modules/pg');

const PROMPT_ID = 'cc69a7f6-8dc5-4fc5-8f64-c9d3a61c2e73';
const DB_URL = process.env.DATABASE_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY;

console.log('DB_URL:', DB_URL ? DB_URL.replace(/:[^:@]+@/, ':***@') : 'MISSING');
console.log('OPENAI_KEY:', OPENAI_KEY ? `...${OPENAI_KEY.slice(-6)}` : 'MISSING');
console.log('ANTHROPIC_KEY:', ANTHROPIC_KEY ? `...${ANTHROPIC_KEY.slice(-6)}` : 'MISSING');
console.log('PERPLEXITY_KEY:', PERPLEXITY_KEY ? `...${PERPLEXITY_KEY.slice(-6)}` : 'MISSING');

const db = new Client({ connectionString: DB_URL });

async function run() {
  await db.connect();
  console.log('\n[1] DB connected');

  // Load prompt
  const promptRes = await db.query('SELECT * FROM tracked_prompts WHERE id=$1', [PROMPT_ID]);
  if (!promptRes.rows.length) { console.log('[ERROR] Prompt not found!'); return; }
  const prompt = promptRes.rows[0];
  console.log('[2] Prompt found:', prompt.prompt_text, '| engines:', JSON.stringify(prompt.engines));

  // Load project
  const projRes = await db.query('SELECT * FROM projects WHERE id=$1', [prompt.project_id]);
  if (!projRes.rows.length) { console.log('[ERROR] Project not found!'); return; }
  const project = projRes.rows[0];
  console.log('[3] Project found:', project.name, '| domain:', project.domain);

  // Brand name
  const bp = project.business_profile;
  const rawBrand = (bp?.companyName) || (bp?.businessName) || (bp?.business_name) || project.name;
  const brandName = rawBrand.replace(/[\s\-_]+\d+$/, '').trim() || rawBrand;
  console.log('[4] Brand name:', brandName);

  // Test OpenAI engine
  console.log('\n[5] Calling OpenAI...');
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-search-preview', messages: [{ role: 'user', content: prompt.prompt_text }] }),
    });
    if (!r.ok) { console.log('[OpenAI] ERROR', r.status, (await r.text()).slice(0, 200)); }
    else {
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content ?? '';
      console.log('[OpenAI] OK, text length:', text.length);
      console.log('[OpenAI] First 300 chars:', text.slice(0, 300));

      // Try DB insert
      try {
        const ins = await db.query(
          `INSERT INTO prompt_visibility_results (prompt_id, project_id, ai_engine, brand_mentioned, visibility_pct, sentiment, response_text)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [PROMPT_ID, prompt.project_id, 'openai', true, '100.00', 'positive', text.slice(0, 1000)]
        );
        console.log('[OpenAI] DB insert OK, id:', ins.rows[0].id);
        // Clean up
        await db.query('DELETE FROM prompt_visibility_results WHERE id=$1', [ins.rows[0].id]);
        console.log('[OpenAI] Cleaned up test row');
      } catch(e) {
        console.log('[OpenAI] DB INSERT ERROR:', e.message);
      }
    }
  } catch(e) {
    console.log('[OpenAI] EXCEPTION:', e.message);
  }

  // Test Perplexity engine
  console.log('\n[6] Calling Perplexity...');
  try {
    const r = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: prompt.prompt_text }] }),
    });
    if (!r.ok) { console.log('[Perplexity] ERROR', r.status, (await r.text()).slice(0, 200)); }
    else {
      const d = await r.json();
      const text = d.choices?.[0]?.message?.content ?? '';
      console.log('[Perplexity] OK, text length:', text.length);
      console.log('[Perplexity] First 300 chars:', text.slice(0, 300));
    }
  } catch(e) {
    console.log('[Perplexity] EXCEPTION:', e.message);
  }

  await db.end();
  console.log('\nDone.');
}

run().catch(e => { console.error('FATAL:', e.message); db.end().catch(() => {}); });
