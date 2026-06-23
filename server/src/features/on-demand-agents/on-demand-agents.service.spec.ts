import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnDemandAgentsService } from './on-demand-agents.service';
import { AgentRouterService } from './agent-router.service';
import { ContextBuilderRegistry } from './context-builders/context-builder.registry';

// Mocks
const mockDb = {
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) }),
    query: {
      agentRuns: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
};

const mockAgentRuntime = {
  execute: vi.fn().mockResolvedValue({
    output: { response: 'Refresh homepage — traffic dropped 25%', recommendations: [{ title: 'Refresh homepage', rationale: 'Traffic dropped 25%' }], citedData: [] },
    reasoning: null,
    thinkingContent: null,
    toolCalls: [{ toolName: 'return_output', input: {}, output: {}, durationMs: 10, success: true }],
    totalTokens: { input: 500, output: 1000 },
    iterations: 1,
    finishReason: 'completed',
  }),
};

const mockCreditsService = {
  hasCredits: vi.fn().mockResolvedValue(true),
  debit: vi.fn().mockResolvedValue(undefined),
};

const mockIntelligenceService = {
  assembleContext: vi.fn().mockResolvedValue({}),
  renderContextXml: vi.fn().mockReturnValue(''),
  upsert: vi.fn().mockResolvedValue({ id: 'pi-1' }),
};

const mockContextBuilder = {
  build: vi.fn().mockResolvedValue({
    systemPrompt: 'You are an SEO expert.',
    dataContext: '## Data\n{"pages": []}',
    summary: 'Analyzed 5 pages',
  }),
};

const mockContextRegistry = {
  get: vi.fn().mockReturnValue(mockContextBuilder),
};

describe('OnDemandAgentsService', () => {
  let service: OnDemandAgentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OnDemandAgentsService(
      mockDb as any,
      mockAgentRuntime as any,
      mockCreditsService as any,
      mockIntelligenceService as any,
      new AgentRouterService(),
      mockContextRegistry as any,
      { run: (_ctx: unknown, fn: () => unknown) => fn() } as any,
    );
  });

  it('runs an agent via AgentRuntime and returns structured response', async () => {
    const result = await service.run({
      projectId: 'proj-1',
      organizationId: 'org-1',
      prompt: 'Which pages need to be refreshed?',
    });

    expect(result.agentType).toBe('content-refresh');
    expect(result.id).toBe('run-1');
    expect(result.creditCost).toBe(5);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(mockAgentRuntime.execute).toHaveBeenCalledWith(expect.objectContaining({
      stepKey: 'on-demand:content-refresh',
      projectId: 'proj-1',
      organizationId: 'org-1',
      allowedTools: [],
    }));
    expect(mockCreditsService.debit).toHaveBeenCalledWith({
      organizationId: 'org-1',
      amount: 5,
      description: 'Agent run: Content Refresh Analyzer',
    });
  });

  it('writes result to PIS with targetKey on success', async () => {
    await service.run({
      projectId: 'proj-1',
      organizationId: 'org-1',
      prompt: 'Which pages need to be refreshed?',
    });

    expect(mockIntelligenceService.upsert).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj-1',
      organizationId: 'org-1',
      dataType: 'on-demand:content-refresh',
      targetKey: 'latest',
      producedBy: 'on-demand:content-refresh',
    }));
  });

  it('still charges credits and returns result when PIS write fails', async () => {
    mockIntelligenceService.upsert.mockRejectedValueOnce(new Error('PIS timeout'));

    const result = await service.run({
      projectId: 'proj-1',
      organizationId: 'org-1',
      prompt: 'Which pages need to be refreshed?',
    });

    // Run completes despite PIS failure
    expect(result.id).toBe('run-1');
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Credits still charged (compute was consumed)
    expect(mockCreditsService.debit).toHaveBeenCalled();
  });

  it('handles raw string output gracefully', async () => {
    mockAgentRuntime.execute.mockResolvedValueOnce({
      output: 'Plain text response without structured JSON',
      reasoning: null,
      thinkingContent: null,
      toolCalls: [],
      totalTokens: { input: 200, output: 100 },
      iterations: 1,
      finishReason: 'completed',
    });

    const result = await service.run({
      projectId: 'proj-1',
      organizationId: 'org-1',
      prompt: 'Which pages need to be refreshed?',
    });

    expect(result.response).toBe('Plain text response without structured JSON');
    expect(result.recommendations).toEqual([]);
    expect(result.citedData).toEqual([]);
  });

  it('handles output with summary field instead of response', async () => {
    mockAgentRuntime.execute.mockResolvedValueOnce({
      output: { summary: 'Summary fallback text', recommendations: [{ title: 'A', rationale: 'B' }], citedData: [] },
      reasoning: null,
      thinkingContent: null,
      toolCalls: [],
      totalTokens: { input: 200, output: 100 },
      iterations: 1,
      finishReason: 'completed',
    });

    const result = await service.run({
      projectId: 'proj-1',
      organizationId: 'org-1',
      prompt: 'Which pages need to be refreshed?',
    });

    expect(result.response).toBe('Summary fallback text');
    expect(result.recommendations).toHaveLength(1);
  });

  it('does not charge credits or write PIS on failure', async () => {
    mockAgentRuntime.execute.mockResolvedValueOnce({
      output: null,
      reasoning: null,
      thinkingContent: null,
      toolCalls: [],
      totalTokens: { input: 0, output: 0 },
      iterations: 1,
      finishReason: 'error',
      error: 'Connection timeout',
    });

    await expect(
      service.run({ projectId: 'proj-1', organizationId: 'org-1', prompt: 'test' }),
    ).rejects.toThrow('Agent runtime failed: Connection timeout');

    expect(mockCreditsService.debit).not.toHaveBeenCalled();
    expect(mockIntelligenceService.upsert).not.toHaveBeenCalled();
  });

  it('rejects when insufficient credits', async () => {
    mockCreditsService.hasCredits.mockResolvedValueOnce(false);

    await expect(
      service.run({ projectId: 'proj-1', organizationId: 'org-1', prompt: 'test' }),
    ).rejects.toThrow('Insufficient credits');
  });

  it('fetches agent run history', async () => {
    await service.getHistory('proj-1');
    expect(mockDb.db.query.agentRuns.findMany).toHaveBeenCalled();
  });
});
