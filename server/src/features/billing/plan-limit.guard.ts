import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq, and, gte, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { organizations, projects, workflowRuns, agentRuns } from '../../db/schema';

/** Plan limits configuration */
const PLAN_LIMITS = {
  starter: { projects: 1, workflowsPerMonth: 5, agentRunsPerMonth: 10 },
  pro: { projects: 5, workflowsPerMonth: 50, agentRunsPerMonth: 100 },
  agency: { projects: 25, workflowsPerMonth: 200, agentRunsPerMonth: 500 },
  enterprise: { projects: -1, workflowsPerMonth: -1, agentRunsPerMonth: -1 }, // unlimited
} as const;

export type PlanLimitKey = keyof (typeof PLAN_LIMITS)['starter'];

export const PLAN_LIMIT_KEY = 'plan_limit';

/**
 * Decorator: @PlanLimit('projects') — checks if org has hit the limit for that resource.
 */
export function PlanLimit(resource: PlanLimitKey) {
  return (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(PLAN_LIMIT_KEY, resource, descriptor?.value ?? target);
    return descriptor ?? target;
  };
}

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<PlanLimitKey>(PLAN_LIMIT_KEY, context.getHandler());
    if (!resource) return true;

    const request = context.switchToHttp().getRequest();
    // Prefer req.org.id (set by OrgMembershipGuard) — avoids relying on untrusted body/params
    const organizationId = request.org?.id ?? request.params?.organizationId ?? request.body?.organizationId;
    if (!organizationId) return true;

    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { plan: true },
    });
    if (!org) return true;

    const limits = PLAN_LIMITS[org.plan];
    const limit = limits[resource];

    // -1 means unlimited
    if (limit === -1) return true;

    const currentUsage = await this.countUsage(resource, organizationId);
    if (currentUsage >= limit) {
      throw new ForbiddenException(
        `Plan limit reached: ${org.plan} allows ${limit} ${resource}. Current usage: ${currentUsage}.`,
      );
    }

    return true;
  }

  private async countUsage(resource: PlanLimitKey, organizationId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    switch (resource) {
      case 'projects': {
        const result = await this.db.db
          .select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .where(eq(projects.organizationId, organizationId));
        return result[0]?.count ?? 0;
      }
      case 'workflowsPerMonth': {
        const result = await this.db.db
          .select({ count: sql<number>`count(*)::int` })
          .from(workflowRuns)
          .where(
            and(
              eq(workflowRuns.organizationId, organizationId),
              gte(workflowRuns.createdAt, startOfMonth),
            ),
          );
        return result[0]?.count ?? 0;
      }
      case 'agentRunsPerMonth': {
        const result = await this.db.db
          .select({ count: sql<number>`count(*)::int` })
          .from(agentRuns)
          .where(
            and(
              eq(agentRuns.organizationId, organizationId),
              gte(agentRuns.createdAt, startOfMonth),
            ),
          );
        return result[0]?.count ?? 0;
      }
    }
  }
}

export { PLAN_LIMITS };
