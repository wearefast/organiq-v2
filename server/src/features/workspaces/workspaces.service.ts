import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { workspaces, projects } from '../../db/schema';

@Injectable()
export class WorkspacesService {
  constructor(private readonly db: DatabaseService) {}

  async findAllByOrg(organizationId: string) {
    return this.db.db.query.workspaces.findMany({
      where: eq(workspaces.organizationId, organizationId),
      with: { projects: true },
      orderBy: (w, { desc }) => [desc(w.createdAt)],
    });
  }

  async findById(id: string, organizationId: string) {
    const workspace = await this.db.db.query.workspaces.findFirst({
      where: and(eq(workspaces.id, id), eq(workspaces.organizationId, organizationId)),
      with: { projects: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async create(data: { organizationId: string; name: string; slug: string; domain?: string }) {
    const [workspace] = await this.db.db
      .insert(workspaces)
      .values(data)
      .returning();
    return workspace;
  }

  async update(id: string, organizationId: string, data: { name?: string; slug?: string; domain?: string }) {
    const [updated] = await this.db.db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workspaces.id, id), eq(workspaces.organizationId, organizationId)))
      .returning();
    if (!updated) throw new NotFoundException('Workspace not found');
    return updated;
  }

  async remove(id: string, organizationId: string) {
    const [deleted] = await this.db.db
      .delete(workspaces)
      .where(and(eq(workspaces.id, id), eq(workspaces.organizationId, organizationId)))
      .returning();
    if (!deleted) throw new NotFoundException('Workspace not found');
    return deleted;
  }
}
