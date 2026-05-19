/**
 * LlmProvider — abstract interface for LLM execution.
 * Each provider (OpenAI, Anthropic) implements this interface.
 * AgentRuntime routes to the appropriate provider based on AgentConfig.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmCompletionOptions {
  messages: LlmMessage[];
  model: string;
  temperature: number;
  tools?: LlmToolDef[];
  maxTokens?: number;
  thinkingBudget?: number;
}

export interface LlmCompletionResult {
  content: string | null;
  toolCalls: LlmToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
  thinkingContent: string | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface LlmProvider {
  readonly name: 'openai' | 'anthropic';

  /**
   * Standard chat completion with optional tool calling.
   * Used by Tier 3 agents (thinking + tools).
   */
  complete(options: LlmCompletionOptions): Promise<LlmCompletionResult>;

  /**
   * Single-shot completion without tool loop.
   * Used by Tier 2 agents (thinking only, no tools).
   * Provider can enable extended thinking if supported.
   */
  completeTier2(options: Omit<LlmCompletionOptions, 'tools'>): Promise<LlmCompletionResult>;
}
