import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Load a prompt file from `.prompts/` relative to the repository root.
 * Splits on `---` separator: everything before = system prompt, everything after = user prompt.
 * No caching — reads from disk every call for hot-reload during prompt tuning.
 */
export function loadPrompt(relativePath: string): { system: string; user: string } {
  const repoRoot = join(process.cwd(), '..');
  const filePath = join(repoRoot, '.prompts', relativePath);
  const raw = readFileSync(filePath, 'utf-8');

  const separatorIndex = raw.indexOf('\n---\n');
  if (separatorIndex === -1) {
    return { system: '', user: raw.trim() };
  }

  const system = raw.slice(0, separatorIndex).trim();
  const user = raw.slice(separatorIndex + 5).trim();
  return { system, user };
}

/**
 * Interpolate `{{key}}` or `{{nested.key}}` placeholders in a template string.
 * Resolves dot-notation paths against the provided vars object.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const value = resolvePath(vars, path.trim());
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
