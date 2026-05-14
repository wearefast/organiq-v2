import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface ParsedPrompt {
  system: string;
  user: string;
}

interface AgentDefinition {
  name: string;
  stepKey: string;
  model: string;
  temperature: number;
  maxIterations: number;
  creditCost: number;
  dependsOn: string[];
  requiresApproval: boolean;
  tools: string[];
  body: string;
  outputSchema?: Record<string, unknown>;
}

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);
  private readonly promptsDir: string;
  private readonly agentsDir: string;
  private readonly cache = new Map<string, { content: string; mtime: number }>();
  private readonly useCache: boolean;
  private static readonly MAX_CACHE_SIZE = 100;

  constructor(private readonly config: ConfigService) {
    this.promptsDir = this.resolveFirstExistingDir([
      join(process.cwd(), 'src', 'prompts'),
      join(process.cwd(), 'server', 'src', 'prompts'),
      join(__dirname, '..', '..', 'prompts'),
      join(__dirname, '..', '..', '..', 'src', 'prompts'),
    ]);
    this.agentsDir = this.resolveFirstExistingDir([
      join(process.cwd(), 'src', 'agents', 'definitions'),
      join(process.cwd(), 'server', 'src', 'agents', 'definitions'),
      join(__dirname, '..', '..', 'agents', 'definitions'),
      join(__dirname, '..', '..', '..', 'src', 'agents', 'definitions'),
    ]);
    this.useCache = config.get('NODE_ENV') === 'production';
  }

  private resolveFirstExistingDir(candidates: string[]): string {
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  /**
   * Load a .prompt.md file, split on `\n---\n` into system + user prompts,
   * then interpolate {{variables}}.
   */
  async loadPrompt(relativePath: string, vars?: Record<string, unknown>): Promise<ParsedPrompt> {
    const filePath = join(this.promptsDir, relativePath);
    const raw = this.normalizeLineEndings(await this.readFileWithCache(filePath));

    const separatorIndex = raw.indexOf('\n---\n');
    let system: string;
    let user: string;

    if (separatorIndex === -1) {
      system = '';
      user = raw.trim();
    } else {
      system = raw.slice(0, separatorIndex).trim();
      user = raw.slice(separatorIndex + 5).trim();
    }

    if (vars) {
      system = this.interpolate(system, vars);
      user = this.interpolate(user, vars);
    }

    return { system, user };
  }

  /**
   * Load an .agent.md definition file, parse YAML frontmatter + markdown body.
   */
  async loadAgentDefinition(stepKey: string): Promise<AgentDefinition> {
    const filePath = join(this.agentsDir, `${stepKey}.agent.md`);
    const raw = this.normalizeLineEndings(await this.readFileWithCache(filePath));
    return this.parseAgentDefinition(raw, stepKey);
  }

  /**
   * Load a rubric file and return raw content for embedding in prompts.
   */
  async loadRubric(relativePath: string): Promise<string> {
    const filePath = join(this.promptsDir, relativePath);
    return this.readFileWithCache(filePath);
  }

  private parseAgentDefinition(raw: string, fallbackKey: string): AgentDefinition {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) {
      throw new Error(`Invalid agent definition: missing YAML frontmatter in ${fallbackKey}`);
    }

    const frontmatter = this.parseYamlFrontmatter(fmMatch[1]);
    const body = fmMatch[2].trim();
    const outputSchema = this.extractOutputSchema(body, fallbackKey);

    return {
      name: frontmatter.name ?? fallbackKey,
      stepKey: frontmatter.step_key ?? fallbackKey,
      model: frontmatter.model ?? 'gpt-4o',
      temperature: parseFloat(frontmatter.temperature ?? '0.3'),
      maxIterations: parseInt(frontmatter.max_iterations ?? '3', 10),
      creditCost: parseInt(frontmatter.credit_cost ?? '50', 10),
      dependsOn: this.parseYamlArray(frontmatter.depends_on),
      requiresApproval: frontmatter.requires_approval === 'true',
      tools: this.parseYamlArray(frontmatter.tools),
      body,
      outputSchema,
    };
  }

  private extractOutputSchema(
    body: string,
    fallbackKey: string,
  ): Record<string, unknown> | undefined {
    const match = body.match(/## Output Schema\s+```(?:json)?\n([\s\S]*?)\n```/);
    if (!match) return undefined;

    try {
      const parsed = JSON.parse(match[1].trim());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.logger.warn(
          `Output schema for ${fallbackKey} must be a top-level JSON object; skipping validation`,
        );
        return undefined;
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to parse output schema for ${fallbackKey}: ${message}`);
      return undefined;
    }
  }

  /**
   * Minimal YAML frontmatter parser — handles flat key: value pairs
   * and simple arrays (  - item).
   */
  private parseYamlFrontmatter(yaml: string): Record<string, string> {
    const result: Record<string, string> = {};
    let currentKey = '';

    for (const line of yaml.split('\n')) {
      const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1];
        const value = kvMatch[2].trim();
        if (value && !value.startsWith('[') && value !== '') {
          result[currentKey] = value;
        } else if (value.startsWith('[') && value.endsWith(']')) {
          // Inline array: [a, b, c]
          result[currentKey] = value;
        } else {
          result[currentKey] = '';
        }
      } else if (line.match(/^\s+-\s+/) && currentKey) {
        const item = line.replace(/^\s+-\s+/, '').trim();
        result[currentKey] = result[currentKey]
          ? `${result[currentKey]},${item}`
          : item;
      }
    }

    return result;
  }

  private parseYamlArray(value: string | undefined): string[] {
    if (!value || value === '[]') return [];
    // Handle inline [a, b, c] format
    if (value.startsWith('[') && value.endsWith(']')) {
      return value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    // Handle comma-separated from parsed block array
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }

  private normalizeLineEndings(value: string): string {
    return value.replace(/\r\n/g, '\n');
  }

  private interpolate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const value = this.resolvePath(vars, path.trim());
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    });
  }

  private resolvePath(obj: Record<string, unknown>, path: string): unknown {
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

  private async readFileWithCache(filePath: string): Promise<string> {
    if (!existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }

    if (!this.useCache) {
      return readFile(filePath, 'utf-8');
    }

    const cached = this.cache.get(filePath);
    if (cached) {
      return cached.content;
    }

    const content = await readFile(filePath, 'utf-8');

    // Evict oldest entry if cache is full
    if (this.cache.size >= PromptService.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(filePath, { content, mtime: Date.now() });
    return content;
  }
}
