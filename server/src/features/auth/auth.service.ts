import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { organizations, orgMembers } from '../../db/schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Handle Clerk organization.created webhook
   */
  async handleOrgCreated(payload: {
    id: string;
    name: string;
    slug: string;
  }) {
    const result = await this.db.db
      .insert(organizations)
      .values({
        clerkOrgId: payload.id,
        name: payload.name,
        slug: payload.slug,
      })
      .onConflictDoNothing()
      .returning();

    if (result.length === 0) {
      return this.findOrgByClerkId(payload.id);
    }

    return result[0];
  }

  /**
   * Handle Clerk organizationMembership.created webhook
   */
  async handleMemberCreated(payload: {
    organization: { id: string };
    public_user_data: { user_id: string; identifier: string; first_name?: string; last_name?: string };
    role: string;
  }) {
    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, payload.organization.id),
    });

    if (!org) return null;

    const name = [payload.public_user_data.first_name, payload.public_user_data.last_name]
      .filter(Boolean)
      .join(' ') || null;

    const role = payload.role === 'org:admin' ? 'admin' : 'member';

    const result = await this.db.db
      .insert(orgMembers)
      .values({
        organizationId: org.id,
        clerkUserId: payload.public_user_data.user_id,
        email: payload.public_user_data.identifier,
        name,
        role: role as 'owner' | 'admin' | 'member',
      })
      .onConflictDoNothing()
      .returning();

    return result[0] ?? null;
  }

  /**
   * Find organization by Clerk org ID
   */
  async findOrgByClerkId(clerkOrgId: string) {
    return this.db.db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, clerkOrgId),
    });
  }

  /**
   * Find member by Clerk user ID within an org
   */
  async findMemberByClerkUserId(clerkUserId: string) {
    return this.db.db.query.orgMembers.findFirst({
      where: eq(orgMembers.clerkUserId, clerkUserId),
    });
  }
}
