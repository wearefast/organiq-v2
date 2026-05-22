/**
 * add-return-output.ts
 * Adds the `return_output` custom tool to all Anthropic managed agents.
 * Run: npx ts-node scripts/add-return-output.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env') });

const RETURN_OUTPUT_TOOL = {
  type: 'custom' as const,
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

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey });

  console.log(`Adding return_output tool to ${AGENTS.length} agents...\n`);

  for (const { stepKey, agentId } of AGENTS) {
    try {
      // Retrieve current agent (need version for update)
      const current = await (client.beta as any).agents.retrieve(agentId);
      const currentTools: any[] = current.tools || [];

      const alreadyHas = currentTools.some((t: any) => t.name === 'return_output');
      if (alreadyHas) {
        console.log(`  ✓ ${stepKey} — already has return_output`);
        continue;
      }

      // Update with return_output added
      const updatedTools = [...currentTools, RETURN_OUTPUT_TOOL];
      await (client.beta as any).agents.update(agentId, {
        tools: updatedTools,
        version: current.version,
      });

      console.log(`  ✓ ${stepKey} — added return_output (total: ${updatedTools.length} tools)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${stepKey} (${agentId}) — ${msg}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
