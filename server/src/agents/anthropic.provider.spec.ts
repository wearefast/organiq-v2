import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from './anthropic.provider';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockAnthropicService: {
    chat: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAnthropicService = {
      chat: vi.fn(),
    };
    provider = new AnthropicProvider(mockAnthropicService as any);
  });

  it('should have name "anthropic"', () => {
    expect(provider.name).toBe('anthropic');
  });

  it('should return content from end_turn response', async () => {
    mockAnthropicService.chat.mockResolvedValue({
      content: '{"strategy": "focus on long-tail"}',
      toolUse: [],
      thinkingContent: 'I analyzed the data...',
      stopReason: 'end_turn',
      usage: { inputTokens: 200, outputTokens: 100 },
    });

    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'You are an SEO expert.' },
        { role: 'user', content: 'Analyze keywords' },
      ],
      model: 'claude-opus-4-20250514',
      temperature: 0.3,
    });

    expect(result.content).toBe('{"strategy": "focus on long-tail"}');
    expect(result.finishReason).toBe('stop');
    expect(result.thinkingContent).toBe('I analyzed the data...');
    expect(result.usage.totalTokens).toBe(300);
  });

  it('should return tool calls when stop reason is tool_use', async () => {
    mockAnthropicService.chat.mockResolvedValue({
      content: null,
      toolUse: [
        { id: 'toolu_1', name: 'ahrefs_organic', input: { domain: 'example.com' } },
      ],
      thinkingContent: null,
      stopReason: 'tool_use',
      usage: { inputTokens: 150, outputTokens: 50 },
    });

    const result = await provider.complete({
      messages: [{ role: 'user', content: 'Get keywords for example.com' }],
      model: 'claude-opus-4-20250514',
      temperature: 0.3,
      tools: [{ name: 'ahrefs_organic', description: 'Get organic keywords', parameters: {} }],
    });

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('ahrefs_organic');
    expect(JSON.parse(result.toolCalls[0].arguments)).toEqual({ domain: 'example.com' });
  });

  it('should map max_tokens to length finish reason', async () => {
    mockAnthropicService.chat.mockResolvedValue({
      content: 'partial...',
      toolUse: [],
      thinkingContent: null,
      stopReason: 'max_tokens',
      usage: { inputTokens: 100, outputTokens: 8192 },
    });

    const result = await provider.complete({
      messages: [{ role: 'user', content: 'Long response' }],
      model: 'claude-opus-4-20250514',
      temperature: 0.3,
    });

    expect(result.finishReason).toBe('length');
  });

  it('completeTier2 should pass thinkingBudget', async () => {
    mockAnthropicService.chat.mockResolvedValue({
      content: '{"verdict": "high potential"}',
      toolUse: [],
      thinkingContent: 'Extended thinking trace...',
      stopReason: 'end_turn',
      usage: { inputTokens: 500, outputTokens: 200 },
    });

    const result = await provider.completeTier2({
      messages: [{ role: 'user', content: 'Synthesize strategy' }],
      model: 'claude-opus-4-20250514',
      temperature: 1,
      thinkingBudget: 32_000,
    });

    expect(result.thinkingContent).toBe('Extended thinking trace...');
    expect(mockAnthropicService.chat).toHaveBeenCalledWith(
      expect.objectContaining({ thinkingBudget: 32000 }),
    );
  });

  it('should separate system message from user messages', async () => {
    mockAnthropicService.chat.mockResolvedValue({
      content: 'ok',
      toolUse: [],
      thinkingContent: null,
      stopReason: 'end_turn',
      usage: { inputTokens: 50, outputTokens: 10 },
    });

    await provider.complete({
      messages: [
        { role: 'system', content: 'System prompt here' },
        { role: 'user', content: 'User message' },
      ],
      model: 'claude-opus-4-20250514',
      temperature: 0.3,
    });

    expect(mockAnthropicService.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'System prompt here',
        messages: [{ role: 'user', content: 'User message' }],
      }),
    );
  });
});
