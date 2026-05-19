/**
 * Sync prompts to Console API.
 * Reads all .agent.md files, extracts frontmatter + body, upserts to Console.
 * Version is tagged with current git commit hash.
 *
 * Usage:
 *   npx ts-node scripts/sync-prompts-to-console.ts [--dry-run] [--diff]
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const AGENTS_DIR = join(__dirname, '..', 'src', 'agents', 'definitions');
const CONSOLE_URL = process.env.PROMPT_CONSOLE_URL;
const CONSOLE_API_KEY = process.env.PROMPT_CONSOLE_API_KEY;

interface AgentPrompt {
  promptId: string;
  stepKey: string;
  name: string;
  content: string;
  version: string;
}

function getGitCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

function parseAgentFile(filePath: string): AgentPrompt | null {
  const raw = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const stepKeyMatch = frontmatter.match(/^step_key\s*:\s*(.+)$/m);
  const nameMatch = frontmatter.match(/^name\s*:\s*(.+)$/m);
  const promptIdMatch = frontmatter.match(/^prompt_id\s*:\s*(.+)$/m);

  const stepKey = stepKeyMatch?.[1]?.trim() ?? '';
  const name = nameMatch?.[1]?.trim() ?? stepKey;
  // Use prompt_id from frontmatter if available, otherwise use step_key
  const promptId = promptIdMatch?.[1]?.trim() ?? stepKey;

  if (!stepKey) return null;

  return {
    promptId,
    stepKey,
    name,
    content: raw,
    version: getGitCommitHash(),
  };
}

async function upsertPrompt(prompt: AgentPrompt): Promise<{ status: number; ok: boolean }> {
  const url = `${CONSOLE_URL}/api/prompts/${encodeURIComponent(prompt.promptId)}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${CONSOLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: prompt.name,
      step_key: prompt.stepKey,
      content: prompt.content,
      version: prompt.version,
      metadata: {
        synced_at: new Date().toISOString(),
        source: 'repo',
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  return { status: response.status, ok: response.ok };
}

async function diffPrompt(prompt: AgentPrompt): Promise<string | null> {
  const url = `${CONSOLE_URL}/api/prompts/${encodeURIComponent(prompt.promptId)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CONSOLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return 'NOT_FOUND';
    const data = (await response.json()) as { content?: string; version?: string };
    if (data.content === prompt.content) return null;
    return `Version on Console: ${data.version ?? 'unknown'} → Local: ${prompt.version}`;
  } catch {
    return 'FETCH_ERROR';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isDiff = args.includes('--diff');

  if (!isDiff && !isDryRun && (!CONSOLE_URL || !CONSOLE_API_KEY)) {
    console.error('Error: PROMPT_CONSOLE_URL and PROMPT_CONSOLE_API_KEY must be set.');
    process.exit(1);
  }

  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.agent.md'));
  console.log(`Found ${files.length} agent definitions in ${AGENTS_DIR}`);

  const prompts: AgentPrompt[] = [];
  for (const file of files) {
    const prompt = parseAgentFile(join(AGENTS_DIR, file));
    if (prompt) prompts.push(prompt);
  }

  console.log(`Parsed ${prompts.length} valid prompts (version: ${prompts[0]?.version ?? 'N/A'})`);

  if (isDiff) {
    if (!CONSOLE_URL || !CONSOLE_API_KEY) {
      console.error('Error: PROMPT_CONSOLE_URL and PROMPT_CONSOLE_API_KEY must be set for diff.');
      process.exit(1);
    }
    console.log('\n--- Diff Report ---');
    for (const prompt of prompts) {
      const diff = await diffPrompt(prompt);
      if (diff === null) {
        console.log(`  ✓ ${prompt.stepKey}: in sync`);
      } else {
        console.log(`  ✗ ${prompt.stepKey}: ${diff}`);
      }
    }
    return;
  }

  if (isDryRun) {
    console.log('\n--- Dry Run (no uploads) ---');
    for (const prompt of prompts) {
      console.log(`  Would sync: ${prompt.stepKey} (promptId: ${prompt.promptId})`);
    }
    return;
  }

  // Actual sync
  let success = 0;
  let failed = 0;
  for (const prompt of prompts) {
    try {
      const result = await upsertPrompt(prompt);
      if (result.ok) {
        console.log(`  ✓ ${prompt.stepKey} → ${result.status}`);
        success++;
      } else {
        console.error(`  ✗ ${prompt.stepKey} → HTTP ${result.status}`);
        failed++;
      }
    } catch (error) {
      console.error(`  ✗ ${prompt.stepKey} → ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} synced, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
