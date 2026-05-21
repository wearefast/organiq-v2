import { Injectable, Logger } from '@nestjs/common';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
}

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool "${tool.name}" is being re-registered`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Return tool definitions in Claude Managed Agents custom tool format.
   * Used by deploy-agents.ts to register tools on Anthropic's platform.
   */
  getClaudeCustomToolDefs(allowedTools: string[]): Array<{
    type: 'custom';
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return allowedTools
      .map((name) => this.tools.get(name))
      .filter((t): t is ToolDefinition => t !== undefined)
      .map((t) => ({
        type: 'custom' as const,
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
  }
}
