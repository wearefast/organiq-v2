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
    output: '1. **Refresh homepage** — Traffic dropped 25%\n2. **Update blog post** — Position declined from 3 to 8',
    reasoning: '',
    toolCalls: [],
    iterations: 1,
    totalTokens: 1500,
    finishReason: 'completed',
  }),
};

const mockCreditsService = {
  hasCredits: vi.fn().mockResolvedValue(true),
  debit: vi.fn().mockResolvedValue(undefined),
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
      new AgentRouterService(),
      mockContextRegistry as any,
    );
  });

  it('runs an agent and returns structured response', async () => {
    const result = await service.run({
      projectId: 'proj-1',
      organizationId: 'org-1',
      prompt: 'Which pages need to be refreshed?',
    });

    expect(result.agentType).toBe('content-refresh');
    expect(result.id).toBe('run-1');
    expect(result.creditCost).toBe(5);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(mockCreditsService.debit).toHaveBeenCalledWith({
      organizationId: 'org-1',
      amount: 5,
      description: 'Agent run: Content Refresh Analyzer',
    });
  });

  it('does not charge credits on failure', async () => {
    mockAgentRuntime.execute.mockResolvedValueOnce({
      output: null,
      finishReason: 'error',
      error: 'LLM timeout',
      reasoning: '',
      toolCalls: [],
      iterations: 0,
      totalTokens: 0,
    });

    await expect(
      service.run({ projectId: 'proj-1', organizationId: 'org-1', prompt: 'test' }),
    ).rejects.toThrow('LLM timeout');

    expect(mockCreditsService.debit).not.toHaveBeenCalled();
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
