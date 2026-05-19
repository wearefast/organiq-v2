import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledWorkflowsService } from './scheduled-workflows.service';

const mockWorkflow = {
  id: 'wf-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  name: 'Weekly AI Summary',
  agentType: 'ai-search-visibility',
  prompt: 'How am I doing in AI search?',
  scheduleCron: '0 9 * * 1',
  deliveryChannel: 'email',
  deliveryTarget: 'test@example.com',
  isActive: true,
  lastRunAt: null,
  nextRunAt: new Date('2026-04-07T09:00:00Z'),
  createdAt: new Date(),
};

const mockDb = {
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockWorkflow]) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([mockWorkflow]) }) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    query: {
      scheduledWorkflows: {
        findMany: vi.fn().mockResolvedValue([mockWorkflow]),
        findFirst: vi.fn().mockResolvedValue(mockWorkflow),
      },
      workflowRunHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
};

describe('ScheduledWorkflowsService', () => {
  let service: ScheduledWorkflowsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ScheduledWorkflowsService(mockDb as any);
  });

  it('creates a workflow with next run time', async () => {
    const result = await service.create({
      projectId: 'proj-1',
      organizationId: 'org-1',
      name: 'Test Workflow',
      agentType: 'content-refresh',
      prompt: 'test prompt',
      scheduleCron: '0 9 * * 1',
      deliveryChannel: 'email',
      deliveryTarget: 'test@example.com',
    });

    expect(result).toBeDefined();
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('finds workflows by project', async () => {
    const result = await service.findByProject('proj-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Weekly AI Summary');
  });

  it('deletes a workflow', async () => {
    await service.delete('wf-1');
    expect(mockDb.db.delete).toHaveBeenCalled();
  });

  it('finds due workflows', async () => {
    // Mock a workflow whose nextRunAt is in the past
    const pastWorkflow = { ...mockWorkflow, nextRunAt: new Date('2020-01-01') };
    mockDb.db.query.scheduledWorkflows.findMany.mockResolvedValueOnce([pastWorkflow]);

    const due = await service.findDueWorkflows();
    expect(due).toHaveLength(1);
  });

  it('records a run', async () => {
    await service.recordRun({
      workflowId: 'wf-1',
      projectId: 'proj-1',
      status: 'success',
      agentResponse: 'Some result',
      delivered: true,
    });

    expect(mockDb.db.insert).toHaveBeenCalled();
    expect(mockDb.db.update).toHaveBeenCalled();
  });
});
