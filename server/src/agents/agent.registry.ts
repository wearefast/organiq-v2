import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PromptService } from '../shared/prompt/prompt.service';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

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
  provider?: 'openai' | 'anthropic';
  /** @deprecated Use executionType instead */
  tier?: 'tier1' | 'tier2' | 'tier3';
  executionType?: 'pipeline-only' | 'pipeline-then-agent' | 'agent-only' | 'agent-with-tools';
  skill?: string;
  thinkingBudget?: number;
  promptId?: string;
  managedAgentId?: string;
}

@Injectable()
export class AgentRegistry implements OnModuleInit {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly agents = new Map<string, AgentDefinition>();
  private readonly definitionsDir: string;

  constructor(private readonly promptService: PromptService) {
    this.definitionsDir = this.resolveDefinitionsDir();
  }

  private resolveDefinitionsDir(): string {
    const candidates = [
      join(process.cwd(), 'src', 'agents', 'definitions'),
      join(process.cwd(), 'server', 'src', 'agents', 'definitions'),
      join(__dirname, 'definitions'),
    ];

    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  async onModuleInit() {
    await this.loadAll();
    this.validateDependencies();
  }

  async loadAll(): Promise<void> {
    let files: string[];
    try {
      files = readdirSync(this.definitionsDir).filter((f) => f.endsWith('.agent.md'));
    } catch {
      this.logger.warn(`No agent definitions directory found at ${this.definitionsDir}`);
      return;
    }

    for (const file of files) {
      const stepKey = file.replace('.agent.md', '');
      try {
        const definition = await this.promptService.loadAgentDefinitionResolved(stepKey);
        this.agents.set(stepKey, definition);
        this.logger.log(`Loaded agent: ${stepKey} (source: ${definition.promptId ? 'console-eligible' : 'local'})`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to load agent "${stepKey}": ${msg}`);
      }
    }

    this.logger.log(`Agent registry loaded: ${this.agents.size} agents`);
  }

  getAgent(stepKey: string): AgentDefinition | undefined {
    return this.agents.get(stepKey);
  }

  getAllAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  getStepKeys(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Build the dependency graph: stepKey → dependsOn[]
   */
  getDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const [key, agent] of this.agents) {
      graph.set(key, agent.dependsOn);
    }
    return graph;
  }

  /**
   * Validate that every dependsOn reference in agent definitions
   * points to a loaded agent. Logs warnings for mismatches.
   */
  private validateDependencies(): void {
    const loadedKeys = new Set(this.agents.keys());
    let issues = 0;

    for (const [stepKey, agent] of this.agents) {
      for (const dep of agent.dependsOn) {
        if (!loadedKeys.has(dep)) {
          this.logger.warn(
            `Agent "${stepKey}" depends on "${dep}" which is not a loaded agent`,
          );
          issues++;
        }
      }
    }

    if (issues === 0) {
      this.logger.log('Agent dependency cross-validation passed');
    } else {
      this.logger.warn(`Agent dependency cross-validation found ${issues} issue(s)`);
    }
  }
}
