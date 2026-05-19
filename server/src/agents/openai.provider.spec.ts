import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAiProvider } from './openai.provider';

describe('OpenAiProvider', () => {
  let provider: OpenAiProvider;
  let mockOpenAiService: {
    chatCompletion: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockOpenAiService = {
      chatCompletion: vi.fn(),
    };
    provider = new OpenAiProvider(mockOpenAiService as any);
  });

  it('should have name "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  it('should return content from a stop response', async () => {
    mockOpenAiService.chatCompletion.mockResolvedValue({
      message: { role: 'assistant', content: '{"keywords": []}', tool_calls: undefined },
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });

    const result = await provider.complete({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
      model: 'gpt-4o',
      temperature: 0.3,
    });

    expect(result.content).toBe('{"keywords": []}');
    expect(result.finishReason).toBe('stop');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.thinkingContent).toBeNull();
    expect(result.usage.totalTokens).toBe(150);
  });

  it('should return tool calls when finish reason is tool_calls', async () => {
    mockOpenAiService.chatCompletion.mockResolvedValue({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'ahrefs_organic', arguments: '{"domain":"example.com"}' } },
        ],
      },
      finishReason: 'tool_calls',
      usage: { promptTokens: 200, completionTokens: 30, totalTokens: 230 },
    });

    const result = await provider.complete({
      messages: [{ role: 'user', content: 'Get keywords' }],
      model: 'gpt-4o',
      temperature: 0.3,
      tools: [{ name: 'ahrefs_organic', description: 'Get organic keywords', parameters: {} }],
    });

    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('ahrefs_organic');
    expect(result.toolCalls[0].arguments).toBe('{"domain":"example.com"}');
  });

  it('should map length finish reason', async () => {
    mockOpenAiService.chatCompletion.mockResolvedValue({
      message: { role: 'assistant', content: 'partial...', tool_calls: undefined },
      finishReason: 'length',
      usage: { promptTokens: 100, completionTokens: 4096, totalTokens: 4196 },
    });

    const result = await provider.complete({
      messages: [{ role: 'user', content: 'Long response' }],
      model: 'gpt-4o',
      temperature: 0.3,
    });

    expect(result.finishReason).toBe('length');
  });

  it('completeTier2 should call complete without tools', async () => {
    mockOpenAiService.chatCompletion.mockResolvedValue({
      message: { role: 'assistant', content: 'tier2 result', tool_calls: undefined },
      finishReason: 'stop',
      usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
    });

    const result = await provider.completeTier2({
      messages: [{ role: 'user', content: 'Analyze' }],
      model: 'gpt-4o',
      temperature: 0.3,
    });

    expect(result.content).toBe('tier2 result');
    expect(mockOpenAiService.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ tools: undefined }),
    );
  });
});
