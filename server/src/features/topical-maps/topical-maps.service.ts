import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { topicalMaps } from '../../db/schema';

@Injectable()
export class TopicalMapsService {
  constructor(private readonly db: DatabaseService) {}

  async findAllByProject(projectId: string) {
    return this.db.db.query.topicalMaps.findMany({
      where: eq(topicalMaps.projectId, projectId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }

  async findById(id: string, projectId: string) {
    const map = await this.db.db.query.topicalMaps.findFirst({
      where: and(eq(topicalMaps.id, id), eq(topicalMaps.projectId, projectId)),
    });
    if (!map) throw new NotFoundException('Topical map not found');
    return map;
  }

  async findByWorkflowRun(workflowRunId: string) {
    return this.db.db.query.topicalMaps.findFirst({
      where: eq(topicalMaps.workflowRunId, workflowRunId),
    });
  }

  async create(input: {
    projectId: string;
    workflowRunId?: string;
    name: string;
    pillars: unknown;
    calendar?: unknown;
  }) {
    const [map] = await this.db.db
      .insert(topicalMaps)
      .values({
        projectId: input.projectId,
        workflowRunId: input.workflowRunId ?? null,
        name: input.name,
        pillars: input.pillars,
        calendar: input.calendar ?? null,
      })
      .returning();
    return map;
  }

  async update(
    id: string,
    projectId: string,
    input: { name?: string; pillars?: unknown; calendar?: unknown },
  ) {
    // Verify exists
    await this.findById(id, projectId);

    const [updated] = await this.db.db
      .update(topicalMaps)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.pillars !== undefined && { pillars: input.pillars }),
        ...(input.calendar !== undefined && { calendar: input.calendar }),
        updatedAt: new Date(),
      })
      .where(and(eq(topicalMaps.id, id), eq(topicalMaps.projectId, projectId)))
      .returning();
    return updated;
  }

  async remove(id: string, projectId: string) {
    await this.findById(id, projectId);
    await this.db.db
      .delete(topicalMaps)
      .where(and(eq(topicalMaps.id, id), eq(topicalMaps.projectId, projectId)));
    return { deleted: true };
  }

  async getStats(projectId: string) {
    const maps = await this.findAllByProject(projectId);
    const latestMap = maps[0];

    if (!latestMap) {
      return { totalMaps: 0, totalPillars: 0, totalClusters: 0, totalPages: 0 };
    }

    const pillars = (latestMap.pillars as any[]) ?? [];
    let totalClusters = 0;
    let totalPages = 0;

    for (const pillar of pillars) {
      const clusters = pillar.clusters ?? [];
      totalClusters += clusters.length;
      for (const cluster of clusters) {
        totalPages += (cluster.pages ?? []).length;
      }
    }

    return {
      totalMaps: maps.length,
      totalPillars: pillars.length,
      totalClusters,
      totalPages,
    };
  }
}
