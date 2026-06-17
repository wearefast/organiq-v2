import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from './agent.runtime';

// ─── Mocks ───────────────────────────────────────────────────

const mockAnthropicChat = vi.fn();
const mockAnthropicService = { chat: mockAnthropicChat };

const mockSandboxExecute = vi.fn();
const mockToolSandbox = { execute: mockSandboxExecute };

const mockGetTool = vi.fn();
const mockToolRegistry = { getTool: mockGetTool };

const mockCreateRefreshSuggestion = vi.fn().mockResolvedValue({ id: 'rs-1' });
const mockIntelligenceService = { createRefreshSuggestion: mockCreateRefreshSuggestion };

const baseConfig = {
  stepKey: 'test-step',
  projectId: 'proj-1',
  organizationId: 'org-1',
  systemPrompt: 'You are a test agent.',
  userPrompt: 'Analyze this data.',
  allowedTools: [],
};

describe('AgentRuntime', () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTool.mockReturnValue(undefined);
    runtime = new AgentRuntime(
      mockAnthropicService as any,
      mockToolSandbox as any,
      mockToolRegistry as any,
      mockIntelligenceService as any,
    );
  });

  describe('execute() — simple completion', () => {
    it('completes in one iteration when model returns end_turn with return_output', async () => {
      mockAnthropicChat.mockResolvedValueOnce({
        content: null,
        toolUse: [{ id: 'tu-1', name: 'return_output', input: { data: { keywords: ['seo'] } } }],
        thinkingContent: 'Let me analyze...',
        stopReason: 'tool_use',
        usage: { inputTokens: 500, outputTokens: 200 },
      });

      const result = await runtime.execute(baseConfig);

      expect(result.output).toEqual({ keywords: ['seo'] });
      expect(result.thinkingContent).toBe('Let me analyze...');
      expect(result.finishReason).toBe('completed');
      expect(result.iterations).toBe(1);
      expect(result.totalTokens).toEqual({ input: 500, output: 200 });
    });

    it('completes when model returns end_turn without tool_use', async () => {
      mockAnthropicChat.mockResolvedValueOnce({
        content: '{"result": "done"}',
        toolUse: [],
        thinkingContent: null,
        stopReason: 'end_turn',
        usage: { inputTokens: 300, outputTokens: 100 },
      });

      const result = await runtime.execute(baseConfig);

      expect(result.output).toEqual({ result: 'done' });
      expect(result.finishReason).toBe('completed');
      expect(result.iterations).toBe(1);
    });
  });

  describe('execute() — multi-turn tool use', () => {
    it('executes tools then completes', async () => {
      // First call: model requests a tool
      mockAnthropicChat.mockResolvedValueOnce({
        content: 'Let me search...',
        toolUse: [{ id: 'tu-1', name: 'serper_search', input: { query: 'seo tools' } }],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 400, outputTokens: 150 },
      });

      // Tool execution succeeds
      mockSandboxExecute.mockResolvedValueOnce({
        success: true,
        result: { organic: [{ title: 'Best SEO Tools' }] },
      });

      // Second call: model returns output
      mockAnthropicChat.mockResolvedValueOnce({
        content: null,
        toolUse: [{ id: 'tu-2', name: 'return_output', input: { data: { analysis: 'complete' } } }],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 600, outputTokens: 100 },
      });

      const result = await runtime.execute({
        ...baseConfig,
        allowedTools: ['serper_search'],
      });

      expect(result.output).toEqual({ analysis: 'complete' });
      expect(result.iterations).toBe(2);
      expect(result.toolCalls).toHaveLength(2); // serper_search + return_output
      expect(result.toolCalls[0].toolName).toBe('serper_search');
      expect(result.toolCalls[0].success).toBe(true);
      expect(result.totalTokens).toEqual({ input: 1000, output: 250 });
      expect(mockSandboxExecute).toHaveBeenCalledWith(
        ['serper_search'],
        'serper_search',
        { query: 'seo tools' },
      );
    });

    it('handles tool execution failure gracefully', async () => {
      mockAnthropicChat.mockResolvedValueOnce({
        content: null,
        toolUse: [{ id: 'tu-1', name: 'ahrefs_domain_rating', input: { domain: 'example.com' } }],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 300, outputTokens: 100 },
      });

      mockSandboxExecute.mockResolvedValueOnce({
        success: false,
        error: 'Rate limited',
      });

      mockAnthropicChat.mockResolvedValueOnce({
        content: '{"fallback": true}',
        toolUse: [],
        thinkingContent: null,
        stopReason: 'end_turn',
        usage: { inputTokens: 500, outputTokens: 50 },
      });

      const result = await runtime.execute({
        ...baseConfig,
        allowedTools: ['ahrefs_domain_rating'],
      });

      expect(result.toolCalls[0].success).toBe(false);
      expect(result.toolCalls[0].output).toBe('Rate limited');
      expect(result.finishReason).toBe('completed');
    });
  });

  describe('execute() — max iterations', () => {
    it('stops at maxIterations and returns max_iterations finish reason', async () => {
      // Always request tools, never finish
      mockAnthropicChat.mockResolvedValue({
        content: null,
        toolUse: [{ id: 'tu-x', name: 'serper_search', input: { query: 'infinite' } }],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      mockSandboxExecute.mockResolvedValue({ success: true, result: {} });

      const result = await runtime.execute({
        ...baseConfig,
        allowedTools: ['serper_search'],
        maxIterations: 3,
      });

      expect(result.finishReason).toBe('max_iterations');
      expect(result.iterations).toBe(3);
      expect(result.output).toBeNull();
    });
  });

  describe('execute() — flag_stale_data', () => {
    it('handles flag_stale_data tool and creates refresh suggestion', async () => {
      mockAnthropicChat.mockResolvedValueOnce({
        content: null,
        toolUse: [
          { id: 'tu-1', name: 'flag_stale_data', input: { data_type: 'site-audit', reason: 'Data is 30 days old', last_updated: '2025-01-01T00:00:00Z' } },
        ],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 300, outputTokens: 100 },
      });

      mockAnthropicChat.mockResolvedValueOnce({
        content: null,
        toolUse: [{ id: 'tu-2', name: 'return_output', input: { data: { done: true } } }],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 400, outputTokens: 50 },
      });

      const result = await runtime.execute(baseConfig);

      expect(mockCreateRefreshSuggestion).toHaveBeenCalledWith({
        projectId: 'proj-1',
        organizationId: 'org-1',
        targetKey: null,
        dataType: 'site-audit',
        lastUpdated: new Date('2025-01-01T00:00:00Z'),
        reason: 'Data is 30 days old',
        suggestedBy: 'test-step',
      });
      expect(result.toolCalls[0].toolName).toBe('flag_stale_data');
      expect(result.toolCalls[0].success).toBe(true);
      expect(result.output).toEqual({ done: true });
    });
  });

  describe('context building', () => {
    it('includes intelligence context in system prompt', async () => {
      mockAnthropicChat.mockResolvedValueOnce({
        content: '{}',
        toolUse: [],
        thinkingContent: null,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      await runtime.execute({
        ...baseConfig,
        intelligenceContext: '<project_intelligence><entry type="site-audit">...</entry></project_intelligence>',
      });

      const callArgs = mockAnthropicChat.mock.calls[0][0];
      // system is now an array of cacheable text blocks
      const systemText = callArgs.system.map((b: any) => b.text).join('\n');
      expect(systemText).toContain('<project_intelligence>');
      expect(systemText).toContain('site-audit');
    });

    it('includes pipeline data and workflow context in user message', async () => {
      mockAnthropicChat.mockResolvedValueOnce({
        content: '{}',
        toolUse: [],
        thinkingContent: null,
        stopReason: 'end_turn',
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      await runtime.execute({
        ...baseConfig,
        pipelineData: { keywords: ['seo'] },
        workflowContext: { 'seed-keywords': { data: 'test' } },
      });

      const callArgs = mockAnthropicChat.mock.calls[0][0];
      const userMsg = callArgs.messages[0].content;
      expect(userMsg).toContain('<pipeline_data>');
      expect(userMsg).toContain('<workflow_context>');
    });
  });

  describe('execute() — error boundary', () => {
    it('returns finishReason "error" when anthropic.chat throws', async () => {
      mockAnthropicChat.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await runtime.execute(baseConfig);

      expect(result.finishReason).toBe('error');
      expect(result.error).toBe('Connection timeout');
      expect(result.output).toBeNull();
      expect(result.iterations).toBe(1);
    });

    it('preserves partial tool calls collected before error', async () => {
      // First iteration succeeds
      mockAnthropicChat.mockResolvedValueOnce({
        content: null,
        toolUse: [{ id: 'tu-1', name: 'serper_search', input: { query: 'test' } }],
        thinkingContent: null,
        stopReason: 'tool_use',
        usage: { inputTokens: 200, outputTokens: 100 },
      });
      mockSandboxExecute.mockResolvedValueOnce({ success: true, result: { data: 'ok' } });

      // Second iteration throws
      mockAnthropicChat.mockRejectedValueOnce(new Error('Rate limited'));

      const result = await runtime.execute({
        ...baseConfig,
        allowedTools: ['serper_search'],
      });

      expect(result.finishReason).toBe('error');
      expect(result.error).toBe('Rate limited');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe('serper_search');
      expect(result.totalTokens).toEqual({ input: 200, output: 100 });
    });
  });
});
