import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { organizations, orgMembers } from '../../db/schema';

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: string) {
    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, id),
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async findByClerkOrgId(clerkOrgId: string) {
    return this.db.db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, clerkOrgId),
    });
  }

  async update(id: string, data: { name?: string; slug?: string }) {
    const [updated] = await this.db.db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Organization not found');
    return updated;
  }

  async getMembers(organizationId: string) {
    return this.db.db.query.orgMembers.findMany({
      where: eq(orgMembers.organizationId, organizationId),
    });
  }

  async addMember(data: {
    organizationId: string;
    clerkUserId: string;
    email: string;
    name?: string;
    role?: 'owner' | 'admin' | 'member';
  }) {
    const [member] = await this.db.db
      .insert(orgMembers)
      .values({
        organizationId: data.organizationId,
        clerkUserId: data.clerkUserId,
        email: data.email,
        name: data.name || null,
        role: data.role || 'member',
      })
      .returning();

    return member;
  }

  async removeMember(organizationId: string, memberId: string) {
    const [deleted] = await this.db.db
      .delete(orgMembers)
      .where(eq(orgMembers.id, memberId))
      .returning();

    if (!deleted) throw new NotFoundException('Member not found');
    return deleted;
  }
}
