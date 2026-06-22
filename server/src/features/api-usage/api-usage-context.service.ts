import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface ApiUsageContext {
  organizationId: string;
  projectId?: string;
  workflowRunId?: string;
  stepKey?: string;
}

/**
 * Propagates org/project/run/step IDs through the call stack using AsyncLocalStorage,
 * so integration services can log API usage without needing explicit parameter passing.
 *
 * Usage in WorkflowProcessor:
 *   await this.apiUsageContext.run({ organizationId, projectId, workflowRunId, stepKey }, async () => {
 *     await this.agentRuntime.execute(...);
 *   });
 *
 * Usage in integration services:
 *   const ctx = this.apiUsageContext.getContext();
 *   // ctx is undefined if called outside a workflow processor context
 */
@Injectable()
export class ApiUsageContextService {
  private readonly storage = new AsyncLocalStorage<ApiUsageContext>();

  /** Run `fn` with the given context available to all downstream async calls. */
  async run<T>(context: ApiUsageContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  /** Returns the current context, or undefined if called outside a tracked context. */
  getContext(): ApiUsageContext | undefined {
    return this.storage.getStore();
  }
}
