import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../../shared/database/database.service';
import { workspaceCreditLimits, workspaces } from '../../db/schema';

@Injectable()
export class WorkspaceCreditLimitService {
  private readonly logger = new Logger(WorkspaceCreditLimitService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Set or update the monthly credit spending limit for a workspace.
   * Uses upsert — creates a new limit record or updates the existing one.
   */
  async setLimit(orgId: string, workspaceId: string, monthlyLimit: number) {
    if (monthlyLimit < 0) {
      throw new BadRequestException('Monthly limit cannot be negative');
    }

    // Validate workspace belongs to this org
    const workspace = await this.db.db.query.workspaces.findFirst({
      where: and(eq(workspaces.id, workspaceId), eq(workspaces.organizationId, orgId)),
      columns: { id: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found in this organization');

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [result] = await this.db.db
      .insert(workspaceCreditLimits)
      .values({
        organizationId: orgId,
        workspaceId,
        monthlyLimit,
        currentMonthUsage: 0,
        periodStart: firstOfMonth,
      })
      .onConflictDoUpdate({
        target: workspaceCreditLimits.workspaceId,
        set: {
          monthlyLimit,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }

  /**
   * Remove a workspace credit limit (no cap).
   */
  async removeLimit(orgId: string, workspaceId: string) {
    const [deleted] = await this.db.db
      .delete(workspaceCreditLimits)
      .where(
        and(
          eq(workspaceCreditLimits.workspaceId, workspaceId),
          eq(workspaceCreditLimits.organizationId, orgId),
        ),
      )
      .returning({ id: workspaceCreditLimits.id });

    return { removed: !!deleted };
  }

  /**
   * Get the current credit limit and usage for a workspace.
   */
  async getLimit(orgId: string, workspaceId: string) {
    const limit = await this.db.db.query.workspaceCreditLimits.findFirst({
      where: and(
        eq(workspaceCreditLimits.workspaceId, workspaceId),
        eq(workspaceCreditLimits.organizationId, orgId),
      ),
    });

    if (!limit) return { workspaceId, hasLimit: false };

    // Return current period usage with self-correcting period check
    const now = new Date();
    const periodExpired =
      new Date(limit.periodStart).getMonth() !== now.getMonth() ||
      new Date(limit.periodStart).getFullYear() !== now.getFullYear();

    return {
      workspaceId,
      hasLimit: true,
      monthlyLimit: limit.monthlyLimit,
      currentMonthUsage: periodExpired ? 0 : limit.currentMonthUsage,
      remainingCredits: periodExpired
        ? limit.monthlyLimit
        : Math.max(0, limit.monthlyLimit - limit.currentMonthUsage),
      periodStart: limit.periodStart,
      periodExpired,
    };
  }

  /**
   * Monthly cron job: reset currentMonthUsage for all limits whose period has rolled over.
   * Runs at midnight on the 1st of every month.
   * The inline reset in CreditsService.debit() is the primary mechanism;
   * this cron job is a safety net for workspaces with no activity.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetExpiredPeriods() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Reset all limits where periodStart is before the start of the current month
    const result = await this.db.db
      .update(workspaceCreditLimits)
      .set({ currentMonthUsage: 0, periodStart: firstOfMonth, updatedAt: now })
      .where(lt(workspaceCreditLimits.periodStart, firstOfMonth));

    this.logger.log(`Monthly credit limit reset complete`);
  }
}
