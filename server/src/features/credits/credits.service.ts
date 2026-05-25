import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { organizations, creditLedger } from '../../db/schema';

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
   */
  async debit(
    params: {
      organizationId: string;
      amount: number;
      description: string;
      workflowRunId?: string;
      stepKey?: string;
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

    const currentBalance = await this.getBalance(params.organizationId);
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
