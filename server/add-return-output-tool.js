/**
 * add-return-output-tool.js
 * Adds the `return_output` custom tool to all Anthropic managed agents.
 * Run: node add-return-output-tool.js
 */
const https = require('https');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

const RETURN_OUTPUT_TOOL = {
  type: 'custom',
  name: 'return_output',
  description:
    'Submit your final structured JSON output. Call this tool ONCE as your absolute last action, passing your complete result object as the `data` parameter.',
  input_schema: {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        description: 'Your complete structured result object',
      },
    },
    required: ['data'],
  },
};

const AGENTS = [
  { stepKey: 'site-audit',                  agentId: 'agent_01FFVEzvSFoTPhF1BXFC2Ye8' },
  { stepKey: 'ai-intelligence',             agentId: 'agent_014oPmb6PAppMEUHVmNRnL47' },
  { stepKey: 'serp-niche-map',              agentId: 'agent_01DSrCmwzv5ExwSU8RhrcY3t' },
  { stepKey: 'competitor-buckets',          agentId: 'agent_016q4DrPJUmNf3yK3RGEzaFP' },
  { stepKey: 'phase1-baseline',             agentId: 'agent_011feQK3Y7U7B9agm3qJYsHJ' },
  { stepKey: 'method01-competitor-pages',   agentId: 'agent_01ETXt112yghvEPojFrm9FbH' },
  { stepKey: 'method02-seed-expansion',     agentId: 'agent_01KaKfxvbSABGsyQwfXiigVt' },
  { stepKey: 'method03-content-gap-import', agentId: 'agent_01Rhf6ozEN9wWD5J89Bt9Su1' },
  { stepKey: 'consolidated-keywords',       agentId: 'agent_01Kt8NxX75CSFjnPWUCwsRbT' },
  { stepKey: 'verdict-strategy',            agentId: 'agent_01CXhZqEp4vtizW6LDHfjq2F' },
  { stepKey: 'topical-map',                 agentId: 'agent_01W9iKyFjygrF4khij8dTATu' },
  { stepKey: 'content-brief',               agentId: 'agent_01EBKZVfY1LApsMUT3Dc948o' },
  { stepKey: 'content-article',             agentId: 'agent_01Q78TEVykFFcCQX77htsFzp' },
  { stepKey: 'content-images',              agentId: 'agent_01TmVScXTpwFk4Y4yTHYQdDF' },
];

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.anthropic.com',
      path,
      method,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'agents-2025-05-14',
        'content-type': 'application/json',
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`Adding return_output tool to ${AGENTS.length} agents...\n`);

  // First, GET one agent to see what API shape looks like
  const probe = await apiRequest('GET', `/v1/beta/agents/${AGENTS[0].agentId}`, null);
  if (probe.status !== 200) {
    console.log('Probe failed, trying /v1/agents/ path...');
    const probe2 = await apiRequest('GET', `/v1/agents/${AGENTS[0].agentId}`, null);
    console.log('Probe2 status:', probe2.status, JSON.stringify(probe2.body).slice(0, 200));
  } else {
    console.log('Probe success! Agent keys:', Object.keys(probe.body));
    console.log('Tools:', JSON.stringify(probe.body.tools || probe.body.custom_tools || []).slice(0, 300));
  }

  for (const { stepKey, agentId } of AGENTS) {
    try {
      // GET current agent
      const getRes = await apiRequest('GET', `/v1/beta/agents/${agentId}`, null);
      if (getRes.status !== 200) {
        console.log(`  ✗ ${stepKey} — GET failed (${getRes.status}): ${JSON.stringify(getRes.body).slice(0, 100)}`);
        continue;
      }
      const agent = getRes.body;
      const currentTools = agent.tools || agent.custom_tools || [];
      const alreadyHas = currentTools.some((t) => t.name === 'return_output');
      if (alreadyHas) {
        console.log(`  ✓ ${stepKey} — already has return_output`);
        continue;
      }

      // PATCH/UPDATE agent
      const updatedTools = [...currentTools, RETURN_OUTPUT_TOOL];
      const updateRes = await apiRequest('POST', `/v1/beta/agents/${agentId}`, { tools: updatedTools });
      if (updateRes.status === 200) {
        console.log(`  ✓ ${stepKey} — added return_output (total: ${updatedTools.length})`);
      } else {
        // Try PATCH
        const patchRes = await apiRequest('PATCH', `/v1/beta/agents/${agentId}`, { tools: updatedTools });
        if (patchRes.status === 200) {
          console.log(`  ✓ ${stepKey} — patched with return_output`);
        } else {
          console.log(`  ✗ ${stepKey} — update failed (${patchRes.status}): ${JSON.stringify(patchRes.body).slice(0, 100)}`);
        }
      }
    } catch (err) {
      console.log(`  ✗ ${stepKey} — error: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
