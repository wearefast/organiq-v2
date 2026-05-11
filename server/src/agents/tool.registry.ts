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
   * Return tool definitions filtered to only those an agent is allowed to use.
   * Format matches OpenAI function calling tool definitions.
   */
  getOpenAiToolDefs(allowedTools: string[]): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> {
    return allowedTools
      .map((name) => this.tools.get(name))
      .filter((t): t is ToolDefinition => t !== undefined)
      .map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
  }
}
