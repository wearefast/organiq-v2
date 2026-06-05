import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectIntelligenceService } from './project-intelligence.service';

const mockReturning = vi.fn();
const mockOnConflictDoUpdate = vi.fn().mockReturnValue({ returning: mockReturning });
const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

const mockWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'rs-1', dismissed: true }]) });
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

const mockFindMany = vi.fn().mockResolvedValue([]);

const mockDb = {
  db: {
    insert: mockInsert,
    update: mockUpdate,
    query: {
      projectIntelligence: { findMany: mockFindMany },
      refreshSuggestions: { findMany: vi.fn().mockResolvedValue([]) },
    },
  },
};

describe('ProjectIntelligenceService', () => {
  let service: ProjectIntelligenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{
      id: 'pi-1',
      projectId: 'proj-1',
      organizationId: 'org-1',
      targetKey: '__foundation__',
      dataType: 'site-audit',
      data: { score: 85 },
      version: 1,
      producedBy: 'site-audit-step',
      updatedAt: new Date('2025-01-01'),
    }]);
    service = new ProjectIntelligenceService(mockDb as any);
  });

  describe('upsert()', () => {
    it('inserts a new intelligence entry with __foundation__ for null targetKey', async () => {
      const result = await service.upsert({
        projectId: 'proj-1',
        organizationId: 'org-1',
        targetKey: null,
        dataType: 'site-audit',
        data: { score: 85 },
        producedBy: 'site-audit-step',
        workflowRunId: 'run-1',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
        projectId: 'proj-1',
        targetKey: '__foundation__',
        dataType: 'site-audit',
        producedBy: 'site-audit-step',
      }));
      expect(result.id).toBe('pi-1');
    });

    it('uses 3-column conflict target (projectId, targetKey, dataType)', async () => {
      await service.upsert({
        projectId: 'proj-1',
        organizationId: 'org-1',
        dataType: 'competitor-analysis',
        data: { competitors: [] },
        producedBy: 'competitor-step',
      });

      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.arrayContaining([
            expect.anything(), // projectId column ref
            expect.anything(), // targetKey column ref
            expect.anything(), // dataType column ref
          ]),
        }),
      );
    });
  });

  describe('assembleContext()', () => {
    it('returns foundation entries keyed by dataType alone', async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          dataType: 'site-audit',
          data: { score: 85 },
          updatedAt: new Date('2025-01-01'),
          version: 2,
          targetKey: '__foundation__',
        },
      ]);

      const context = await service.assembleContext({
        projectId: 'proj-1',
        organizationId: 'org-1',
      });

      expect(context['site-audit']).toBeDefined();
      expect(context['site-audit'].data).toEqual({ score: 85 });
      expect(context['site-audit'].version).toBe(2);
    });

    it('keys target-specific entries as dataType:target to avoid collision', async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          dataType: 'search-demand',
          data: { foundation: true },
          updatedAt: new Date('2025-01-01'),
          version: 1,
          targetKey: '__foundation__',
        },
        {
          dataType: 'search-demand',
          data: { target: true },
          updatedAt: new Date('2025-01-02'),
          version: 1,
          targetKey: 'us-en',
        },
      ]);

      const context = await service.assembleContext({
        projectId: 'proj-1',
        organizationId: 'org-1',
        targetKey: 'us-en',
      });

      // Foundation entry keyed plainly
      expect(context['search-demand']).toBeDefined();
      expect(context['search-demand'].data).toEqual({ foundation: true });
      // Target entry keyed with suffix
      expect(context['search-demand:us-en']).toBeDefined();
      expect(context['search-demand:us-en'].data).toEqual({ target: true });
    });
  });

  describe('renderContextXml()', () => {
    it('renders empty string for empty context', () => {
      const xml = service.renderContextXml({});
      expect(xml).toBe('');
    });

    it('renders XML with entries and escapes attributes', () => {
      const xml = service.renderContextXml({
        'site-audit': {
          data: { score: 85 },
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          version: 2,
          target: '__foundation__',
        },
      });

      expect(xml).toContain('<project_intelligence>');
      expect(xml).toContain('type="site-audit"');
      expect(xml).toContain('target="__foundation__"');
      expect(xml).toContain('version="2"');
      expect(xml).toContain('</project_intelligence>');
    });

    it('renders target-specific entries correctly', () => {
      const xml = service.renderContextXml({
        'search-demand:us-en': {
          data: { keywords: 500 },
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          version: 1,
          target: 'us-en',
        },
      });

      expect(xml).toContain('type="search-demand"');
      expect(xml).toContain('target="us-en"');
    });

    it('escapes dangerous characters in attributes', () => {
      const xml = service.renderContextXml({
        'test': {
          data: {},
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
          version: 1,
          target: 'foo"<bar>',
        },
      });

      expect(xml).toContain('target="foo&quot;&lt;bar&gt;"');
      expect(xml).not.toContain('target="foo"<bar>"');
    });
  });
});
