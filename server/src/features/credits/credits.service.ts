import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { eq, desc, and, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { organizations, creditLedger, workspaceCreditLimits } from '../../db/schema';

@Injectable()
export class CreditsService {
  constructor(private readonly db: DatabaseService) {}

  async getBalance(organizationId: string): Promise<number> {
    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: { creditsBalance: true },
    });
    return org?.creditsBalance ?? 0;
  }

  async getTransactions(organizationId: string, limit = 50) {
    return this.db.db.query.creditLedger.findMany({
      where: eq(creditLedger.organizationId, organizationId),
      orderBy: [desc(creditLedger.createdAt)],
      limit,
    });
  }

  /**
   * Pre-check: does the org have enough credits for an operation?
   */
  async hasCredits(organizationId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(organizationId);
    return balance >= amount;
  }

  /**
   * Debit credits (negative amount). Used by workflow step processor.
   * Pass an optional `tx` to run inside a caller-managed transaction.
   *
   * If `workspaceId` is provided and a credit limit exists for that workspace,
   * the debit is also checked against the workspace monthly spending cap.
   */
  async debit(
    params: {
      organizationId: string;
      amount: number;
      description: string;
      workflowRunId?: string;
      stepKey?: string;
      /** Optional: enables workspace-level credit limit enforcement */
      workspaceId?: string;
    },
    externalTx?: Parameters<Parameters<typeof this.db.db.transaction>[0]>[0],
  ) {
    if (params.amount <= 0) throw new BadRequestException('Debit amount must be positive');

    const executor = async (tx: typeof externalTx extends undefined ? never : NonNullable<typeof externalTx>) => {
      const org = await tx.query.organizations.findFirst({
        where: eq(organizations.id, params.organizationId),
        columns: { creditsBalance: true },
      });
      const currentBalance = org?.creditsBalance ?? 0;
      if (currentBalance < params.amount) {
        throw new BadRequestException('Insufficient credits');
      }
      const newBalance = currentBalance - params.amount;

      // ── Workspace credit limit check ───────────────────────────────────────
      if (params.workspaceId) {
        // SELECT FOR UPDATE locks the row for the duration of this transaction,
        // preventing concurrent debits from racing past the limit check.
        const rows = await tx.execute(
          sql`SELECT * FROM workspace_credit_limits WHERE workspace_id = ${params.workspaceId} FOR UPDATE`,
        );
        const limit = rows.rows[0] as {
          id: string;
          monthly_limit: number;
          current_month_usage: number;
          period_start: Date;
        } | undefined;

        if (limit) {
          const now = new Date();
          const periodStart = new Date(limit.period_start);
          let currentUsage = limit.current_month_usage;

          // Calendar-month period rollover check
          const periodExpired =
            periodStart.getMonth() !== now.getMonth() ||
            periodStart.getFullYear() !== now.getFullYear();

          if (periodExpired) {
            currentUsage = 0;
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            await tx
              .update(workspaceCreditLimits)
              .set({ currentMonthUsage: 0, periodStart: firstOfMonth, updatedAt: now })
              .where(eq(workspaceCreditLimits.workspaceId, params.workspaceId));
          }

          if (currentUsage + params.amount > limit.monthly_limit) {
            throw new BadRequestException(
              `Workspace monthly credit limit reached (${currentUsage}/${limit.monthly_limit} used)`,
            );
          }

          // Increment workspace usage — safe because we hold a FOR UPDATE lock
          await tx
            .update(workspaceCreditLimits)
            .set({ currentMonthUsage: currentUsage + params.amount, updatedAt: now })
            .where(eq(workspaceCreditLimits.workspaceId, params.workspaceId));
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      await tx
        .update(organizations)
        .set({ creditsBalance: newBalance, updatedAt: new Date() })
        .where(eq(organizations.id, params.organizationId));

      await tx.insert(creditLedger).values({
        organizationId: params.organizationId,
        amount: -params.amount,
        balanceAfter: newBalance,
        type: 'usage',
        description: params.description,
        workflowRunId: params.workflowRunId,
        stepKey: params.stepKey,
        workspaceId: params.workspaceId,
      });

      return { balance: newBalance };
    };

    if (externalTx) {
      return executor(externalTx as any);
    }

    let result!: { balance: number };
    await this.db.db.transaction(async (tx) => {
      result = await executor(tx as any);
    });
    return result;
  }

  /**
   * Credit (positive amount). Used for purchases and refunds.
   */
  async credit(params: {
    organizationId: string;
    amount: number;
    type: 'purchase' | 'refund' | 'bonus';
    description: string;
  }) {
    if (params.amount <= 0) throw new BadRequestException('Credit amount must be positive');

    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, params.organizationId),
      columns: { creditsBalance: true },
    });
    if (!org) throw new NotFoundException(`Organization not found`);
    const currentBalance = org.creditsBalance;
    const newBalance = currentBalance + params.amount;

    await this.db.db.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({ creditsBalance: newBalance, updatedAt: new Date() })
        .where(eq(organizations.id, params.organizationId));

      await tx.insert(creditLedger).values({
        organizationId: params.organizationId,
        amount: params.amount,
        balanceAfter: newBalance,
        type: params.type,
        description: params.description,
      });
    });

    return { balance: newBalance };
  }
}
