import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { projects } from '../../db/schema';
import { sanitizeDomain } from '../../shared/utils/sanitize-domain';

@Injectable()
export class ProjectsService {
  constructor(private readonly db: DatabaseService) {}

  async findAllByWorkspace(workspaceId: string) {
    return this.db.db.query.projects.findMany({
      where: eq(projects.workspaceId, workspaceId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }

  async findById(id: string, organizationId: string) {
    const project = await this.db.db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.organizationId, organizationId)),
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(data: {
    workspaceId: string;
    organizationId: string;
    name: string;
    domain: string;
    country?: string;
    language?: string;
    industry?: string;
  }) {
    const [project] = await this.db.db
      .insert(projects)
      .values({ ...data, domain: sanitizeDomain(data.domain) })
      .returning();
    return project;
  }

  async update(
    id: string,
    organizationId: string,
    data: { name?: string; domain?: string; country?: string; language?: string; industry?: string },
  ) {
    const sanitized = data.domain ? { ...data, domain: sanitizeDomain(data.domain) } : data;
    const [updated] = await this.db.db
      .update(projects)
      .set({ ...sanitized, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    if (!updated) throw new NotFoundException('Project not found');
    return updated;
  }

  async remove(id: string, organizationId: string) {
    const [deleted] = await this.db.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
      .returning();
    if (!deleted) throw new NotFoundException('Project not found');
    return deleted;
  }
}
