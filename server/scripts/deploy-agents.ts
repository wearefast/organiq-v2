/**
 * deploy-agents.ts — Creates/updates all Tier 3 agents on Anthropic's Managed Agents platform.
 *
 * Usage: npx ts-node scripts/deploy-agents.ts
 *
 * What it does:
 * 1. Reads all .agent.md files from definitions/
 * 2. Filters for tier: 3 agents only (Managed Agents)
 * 3. Creates an environment (or reuses existing) on Anthropic platform
 * 4. Creates/updates each agent with system prompt + custom tool schemas
 * 5. Outputs agent IDs to stdout for manual .env or .agent.md updates
 */

import Anthropic from '@anthropic-ai/sdk';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

interface AgentFrontmatter {
  name: string;
  step_key: string;
  model: string;
  provider: string;
  tier: number;
  thinking_budget?: number;
  temperature: number;
  max_iterations: number;
  credit_cost: number;
  prompt_id: string;
  depends_on: string[];
  requires_approval: boolean;
  tools: string[];
  managed_agent_id?: string;
}

function parseFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const normalized = content.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Invalid .agent.md format — no frontmatter found');

  const yamlLines = match[1].split('\n');
  const frontmatter: Record<string, unknown> = {};
  let currentKey = '';
  let arrayMode = false;
  let arrayValues: string[] = [];

  for (const line of yamlLines) {
    if (arrayMode) {
      if (line.startsWith('  - ')) {
        arrayValues.push(line.replace('  - ', '').trim());
        continue;
      } else {
        frontmatter[currentKey] = arrayValues;
        arrayMode = false;
        arrayValues = [];
      }
    }

    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();

      if (value === '' || value === '[]') {
        // Check if next lines have array items
        if (value === '[]') {
          frontmatter[currentKey] = [];
        } else {
          arrayMode = true;
          arrayValues = [];
        }
      } else if (value === 'true') {
        frontmatter[currentKey] = true;
      } else if (value === 'false') {
        frontmatter[currentKey] = false;
      } else if (/^\d+$/.test(value)) {
        frontmatter[currentKey] = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        frontmatter[currentKey] = parseFloat(value);
      } else {
        frontmatter[currentKey] = value;
      }
    }
  }

  // Flush last array
  if (arrayMode) {
    frontmatter[currentKey] = arrayValues;
  }

  return { frontmatter: frontmatter as unknown as AgentFrontmatter, body: match[2] };
}

/**
 * Load tool schemas from the ToolBootstrap registry definitions.
 * Since we can't instantiate NestJS DI here, we read from a static export.
 */
function getToolSchemas(): Map<string, { name: string; description: string; input_schema: Record<string, unknown> }> {
  // For deployment, tool schemas are read from a generated manifest.
  // Run `npx ts-node scripts/export-tool-schemas.ts` first to generate it.
  const manifestPath = join(__dirname, '..', 'tool-schemas.json');
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    const schemas = JSON.parse(raw) as Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
    return new Map(schemas.map((s) => [s.name, s]));
  } catch {
    console.warn('⚠️  tool-schemas.json not found. Run `npx ts-node scripts/export-tool-schemas.ts` first.');
    console.warn('   Deploying agents without tool definitions for now.');
    return new Map();
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey });
  const definitionsDir = join(__dirname, '..', 'src', 'agents', 'definitions');

  // Model name mapping: short names → full API model IDs
  const MODEL_MAP: Record<string, string> = {
    'claude-opus-4': 'claude-opus-4-6',
    'claude-sonnet-4': 'claude-sonnet-4-6',
    'gpt-4o': 'claude-sonnet-4-6', // GPT agents get remapped to Claude
  };

  // 1. Load all tier 3 agent definitions
  const files = readdirSync(definitionsDir).filter((f) => f.endsWith('.agent.md'));
  const tier3Agents: Array<{ frontmatter: AgentFrontmatter; body: string; file: string }> = [];

  for (const file of files) {
    const content = readFileSync(join(definitionsDir, file), 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);
    if (frontmatter.tier === 3) {
      tier3Agents.push({ frontmatter, body, file });
    }
  }

  console.log(`Found ${tier3Agents.length} Tier 3 agents to deploy:\n`);
  for (const a of tier3Agents) {
    console.log(`  - ${a.frontmatter.step_key} (${a.frontmatter.name}) [${a.frontmatter.tools.length} tools]`);
  }

  // 2. Load tool schemas
  const toolSchemas = getToolSchemas();

  // 3. Create or get environment
  console.log('\n📦 Creating environment...');
  let environmentId = process.env.MANAGED_AGENT_ENVIRONMENT_ID;

  if (!environmentId) {
    const env = await (client.beta as any).environments.create({
      name: 'pulse-production',
      description: 'Pulse OS production environment for SEO workflow agents',
    });
    environmentId = env.id;
    console.log(`   Environment created: ${environmentId}`);
    console.log(`   Add to .env: MANAGED_AGENT_ENVIRONMENT_ID=${environmentId}`);
  } else {
    console.log(`   Using existing environment: ${environmentId}`);
  }

  // 4. Deploy each agent
  console.log('\n🚀 Deploying agents...\n');
  const results: Array<{ stepKey: string; agentId: string }> = [];

  for (const agent of tier3Agents) {
    const { frontmatter, body } = agent;

    // Build custom tool definitions for this agent
    const customTools = frontmatter.tools
      .map((toolName) => {
        const schema = toolSchemas.get(toolName);
        if (!schema) {
          console.warn(`   ⚠️  Tool schema not found: ${toolName}`);
          return null;
        }
        return {
          type: 'custom' as const,
          name: schema.name,
          description: schema.description,
          input_schema: schema.input_schema,
        };
      })
      .filter(Boolean);

    // Minimal platform system prompt — the full rendered prompt is sent at runtime via user message.
    // This keeps the platform agent generic; project-specific data is interpolated at execution time.
    const systemPrompt = `You are ${frontmatter.name}, a Pulse OS workflow agent for the "${frontmatter.step_key}" step. Follow the detailed instructions provided in each session's user message. Always produce valid JSON output.`;
    const resolvedModel = MODEL_MAP[frontmatter.model] ?? frontmatter.model;

    try {
      if (frontmatter.managed_agent_id) {
        // Fetch current agent to get version for update
        const current = await (client.beta as any).agents.retrieve(frontmatter.managed_agent_id);
        // Update existing agent
        await (client.beta as any).agents.update(frontmatter.managed_agent_id, {
          name: frontmatter.name,
          description: `Pulse workflow step: ${frontmatter.step_key}`,
          model: resolvedModel,
          system: systemPrompt,
          tools: customTools,
          version: current.version,
        });
        console.log(`   ✅ Updated: ${frontmatter.step_key} → ${frontmatter.managed_agent_id}`);
        results.push({ stepKey: frontmatter.step_key, agentId: frontmatter.managed_agent_id });
      } else {
        // Create new agent
        const created = await (client.beta as any).agents.create({
          name: frontmatter.name,
          description: `Pulse workflow step: ${frontmatter.step_key}`,
          model: resolvedModel,
          system: systemPrompt,
          tools: customTools,
        });
        console.log(`   ✅ Created: ${frontmatter.step_key} → ${created.id}`);
        results.push({ stepKey: frontmatter.step_key, agentId: created.id });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed: ${frontmatter.step_key} — ${msg}`);
    }
  }

  // 5. Output summary
  console.log('\n📋 Deployment Summary:\n');
  console.log('Add these to your .agent.md frontmatter as `managed_agent_id`:');
  console.log('---');
  for (const r of results) {
    console.log(`${r.stepKey}: ${r.agentId}`);
  }
  console.log('---');

  if (!process.env.MANAGED_AGENT_ENVIRONMENT_ID) {
    console.log(`\nAdd to .env:\nMANAGED_AGENT_ENVIRONMENT_ID=${environmentId}`);
  }
}

main().catch((err) => {
  console.error('Deploy failed:', err);
  process.exit(1);
});
