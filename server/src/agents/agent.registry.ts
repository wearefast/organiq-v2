import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PromptService } from '../shared/prompt/prompt.service';
import { readdirSync } from 'fs';
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
}

@Injectable()
export class AgentRegistry implements OnModuleInit {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly agents = new Map<string, AgentDefinition>();
  private readonly definitionsDir: string;

  constructor(private readonly promptService: PromptService) {
    this.definitionsDir = join(process.cwd(), '..', 'server', 'src', 'agents', 'definitions');
  }

  async onModuleInit() {
    await this.loadAll();
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
        const definition = await this.promptService.loadAgentDefinition(stepKey);
        this.agents.set(stepKey, definition);
        this.logger.log(`Loaded agent: ${stepKey}`);
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
}
