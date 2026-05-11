import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';

@Injectable()
export class ToolSandbox {
  private readonly logger = new Logger(ToolSandbox.name);

  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * Check if an agent is allowed to execute a specific tool.
   */
  canExecute(agentTools: string[], toolName: string): boolean {
    return agentTools.includes(toolName);
  }

  /**
   * Execute a tool call within the sandbox.
   * Validates the tool is in the agent's allowed list before executing.
   */
  async execute(
    agentTools: string[],
    toolName: string,
    input: unknown,
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    if (!this.canExecute(agentTools, toolName)) {
      this.logger.warn(`Blocked tool call: ${toolName} (not in agent's allowed tools)`);
      return {
        success: false,
        error: `Tool "${toolName}" is not available to this agent`,
      };
    }

    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      this.logger.error(`Tool not found in registry: ${toolName}`);
      return {
        success: false,
        error: `Tool "${toolName}" is not registered`,
      };
    }

    try {
      const result = await tool.execute(input);
      return { success: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Tool execution failed: ${toolName} — ${message}`);
      return { success: false, error: message };
    }
  }
}
