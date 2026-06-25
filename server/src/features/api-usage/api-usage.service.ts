import { Injectable, Logger } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { apiUsageLogs, organizations, projects, workflowRuns } from '../../db/schema';

export interface CreateApiUsageLogDto {
  organizationId: string;
  projectId?: string | null;
  workflowRunId?: string | null;
  stepKey?: string | null;
  provider: string;
  endpoint: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd: number;
  durationMs?: number | null;
  success?: boolean;
}

export interface ApiUsageSummaryFilters {
  orgId?: string;
  from: Date;
  to: Date;
}

export interface ProviderTotals {
  provider: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface DailyTotal {
  date: string;
  provider: string;
  calls: number;
  costUsd: number;
}

export interface ApiUsageSummary {
  totalCostUsd: number;
  totalCalls: number;
  byProvider: ProviderTotals[];
  byDay: DailyTotal[];
}

export interface ProjectCost {
  projectId: string;
  projectName: string;
  workspaceName: string;
  runs: number;
  calls: number;
  costUsd: number;
}

export interface RunStepCost {
  stepKey: string;
  provider: string;
  endpoint: string;
  tokensIn: number | null;
  tokensOut: number | null;
  calls: number;
  costUsd: number;
  durationMs: number | null;
  createdAt: Date;
}

/** One row in the flat project breakdown — frontend groups by workflowRunId */
export interface ProjectBreakdownRow {
  workflowRunId: string | null;
  stepKey: string | null;
  provider: string;
  endpoint: string;
  calls: number;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number;
  createdAt: Date;
}

@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Fire-and-forget log entry. Never throws — a logging failure must never
   * break the actual API call it's instrumenting.
   */
  record(entry: CreateApiUsageLogDto): void {
    // Round cost to 6 decimal places to match decimal(10,6) column
    const costUsd = Math.round(entry.costUsd * 1_000_000) / 1_000_000;

    this.db.db
      .insert(apiUsageLogs)
      .values({
        organizationId: entry.organizationId,
        projectId: entry.projectId ?? null,
        workflowRunId: entry.workflowRunId ?? null,
        stepKey: entry.stepKey ?? null,
        provider: entry.provider,
        endpoint: entry.endpoint,
        tokensIn: entry.tokensIn ?? null,
        tokensOut: entry.tokensOut ?? null,
        costUsd: String(costUsd),
        durationMs: entry.durationMs ?? null,
        success: entry.success ?? true,
      })
      .then(() => {
        // no-op on success
      })
      .catch((err: unknown) => {
        // Log but never propagate — cost tracking must never crash the app
        this.logger.error(
          `Failed to record API usage log: provider=${entry.provider} endpoint=${entry.endpoint} org=${entry.organizationId}`,
          err instanceof Error ? err.message : String(err),
        );
      });
  }

  /** Aggregate cost summary across all orgs or a specific org in a date range. */
  async getSummary(filters: ApiUsageSummaryFilters): Promise<ApiUsageSummary> {
    const conditions = [
      gte(apiUsageLogs.createdAt, filters.from),
      lte(apiUsageLogs.createdAt, filters.to),
      ...(filters.orgId ? [eq(apiUsageLogs.organizationId, filters.orgId)] : []),
    ];

    const [providerRows, dayRows] = await Promise.all([
      // By provider
      this.db.db
        .select({
          provider: apiUsageLogs.provider,
          calls: sql<number>`cast(count(*) as int)`,
          tokensIn: sql<number>`cast(coalesce(sum(${apiUsageLogs.tokensIn}), 0) as int)`,
          tokensOut: sql<number>`cast(coalesce(sum(${apiUsageLogs.tokensOut}), 0) as int)`,
          costUsd: sql<number>`cast(sum(${apiUsageLogs.costUsd}) as float)`,
        })
        .from(apiUsageLogs)
        .where(and(...conditions))
        .groupBy(apiUsageLogs.provider)
        .orderBy(desc(sql`sum(${apiUsageLogs.costUsd})`)),

      // By day + provider
      this.db.db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${apiUsageLogs.createdAt}), 'YYYY-MM-DD')`,
          provider: apiUsageLogs.provider,
          calls: sql<number>`cast(count(*) as int)`,
          costUsd: sql<number>`cast(sum(${apiUsageLogs.costUsd}) as float)`,
        })
        .from(apiUsageLogs)
        .where(and(...conditions))
        .groupBy(
          sql`date_trunc('day', ${apiUsageLogs.createdAt})`,
          apiUsageLogs.provider,
        )
        .orderBy(asc(sql`date_trunc('day', ${apiUsageLogs.createdAt})`)),
    ]);

    const totalCostUsd = providerRows.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    const totalCalls = providerRows.reduce((s, r) => s + (r.calls ?? 0), 0);

    return {
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      totalCalls,
      byProvider: providerRows.map((r) => ({
        provider: r.provider,
        calls: r.calls ?? 0,
        tokensIn: r.tokensIn ?? 0,
        tokensOut: r.tokensOut ?? 0,
        costUsd: Math.round((r.costUsd ?? 0) * 1_000_000) / 1_000_000,
      })),
      byDay: dayRows.map((r) => ({
        date: r.date,
        provider: r.provider,
        calls: r.calls ?? 0,
        costUsd: Math.round((r.costUsd ?? 0) * 1_000_000) / 1_000_000,
      })),
    };
  }

  /** Per-project cost breakdown for an org in a date range. */
  async getByProject(filters: ApiUsageSummaryFilters): Promise<ProjectCost[]> {
    const conditions = [
      gte(apiUsageLogs.createdAt, filters.from),
      lte(apiUsageLogs.createdAt, filters.to),
      ...(filters.orgId ? [eq(apiUsageLogs.organizationId, filters.orgId)] : []),
    ];

    const rows = await this.db.db
      .select({
        projectId: apiUsageLogs.projectId,
        projectName: projects.name,
        workspaceName: sql<string>`(SELECT name FROM workspaces WHERE id = ${projects.workspaceId})`,
        runs: sql<number>`cast(count(distinct ${apiUsageLogs.workflowRunId}) as int)`,
        calls: sql<number>`cast(count(*) as int)`,
        costUsd: sql<number>`cast(sum(${apiUsageLogs.costUsd}) as float)`,
      })
      .from(apiUsageLogs)
      .leftJoin(projects, eq(apiUsageLogs.projectId, projects.id))
      .where(and(...conditions))
      .groupBy(apiUsageLogs.projectId, projects.name, projects.workspaceId)
      .orderBy(desc(sql`sum(${apiUsageLogs.costUsd})`));

    return rows.map((r) => ({
      projectId: r.projectId ?? 'unknown',
      projectName: r.projectName ?? '(no project)',
      workspaceName: r.workspaceName ?? '',
      runs: r.runs ?? 0,
      calls: r.calls ?? 0,
      costUsd: Math.round((r.costUsd ?? 0) * 1_000_000) / 1_000_000,
    }));
  }

  /** Per-step cost breakdown for a specific workflow run. */
  async getByWorkflowRun(workflowRunId: string): Promise<RunStepCost[]> {
    const rows = await this.db.db
      .select({
        stepKey: apiUsageLogs.stepKey,
        provider: apiUsageLogs.provider,
        endpoint: apiUsageLogs.endpoint,
        tokensIn: sql<number | null>`sum(${apiUsageLogs.tokensIn})`,
        tokensOut: sql<number | null>`sum(${apiUsageLogs.tokensOut})`,
        calls: sql<number>`cast(count(*) as int)`,
        costUsd: sql<number>`cast(sum(${apiUsageLogs.costUsd}) as float)`,
        durationMs: sql<number | null>`sum(${apiUsageLogs.durationMs})`,
        createdAt: sql<Date>`min(${apiUsageLogs.createdAt})`,
      })
      .from(apiUsageLogs)
      .where(eq(apiUsageLogs.workflowRunId, workflowRunId))
      .groupBy(apiUsageLogs.stepKey, apiUsageLogs.provider, apiUsageLogs.endpoint)
      .orderBy(asc(sql`min(${apiUsageLogs.createdAt})`));

    return rows.map((r) => ({
      stepKey: r.stepKey ?? '',
      provider: r.provider,
      endpoint: r.endpoint,
      tokensIn: r.tokensIn ?? null,
      tokensOut: r.tokensOut ?? null,
      calls: r.calls ?? 0,
      costUsd: Math.round((r.costUsd ?? 0) * 1_000_000) / 1_000_000,
      durationMs: r.durationMs ?? null,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Full cost breakdown for a single project — flat list grouped by
   * (workflowRunId, stepKey, provider, endpoint). Frontend aggregates into
   * "Workflow Runs" vs "Feature Calls" (null workflowRunId) sections.
   */
  async getByProjectBreakdown(projectId: string, from: Date, to: Date): Promise<ProjectBreakdownRow[]> {
    const rows = await this.db.db
      .select({
        workflowRunId: apiUsageLogs.workflowRunId,
        stepKey: apiUsageLogs.stepKey,
        provider: apiUsageLogs.provider,
        endpoint: apiUsageLogs.endpoint,
        calls: sql<number>`cast(count(*) as int)`,
        tokensIn: sql<number | null>`cast(coalesce(sum(${apiUsageLogs.tokensIn}), null) as int)`,
        tokensOut: sql<number | null>`cast(coalesce(sum(${apiUsageLogs.tokensOut}), null) as int)`,
        costUsd: sql<number>`cast(sum(${apiUsageLogs.costUsd}) as float)`,
        createdAt: sql<Date>`min(${apiUsageLogs.createdAt})`,
      })
      .from(apiUsageLogs)
      .where(and(
        eq(apiUsageLogs.projectId, projectId),
        gte(apiUsageLogs.createdAt, from),
        lte(apiUsageLogs.createdAt, to),
      ))
      .groupBy(
        apiUsageLogs.workflowRunId,
        apiUsageLogs.stepKey,
        apiUsageLogs.provider,
        apiUsageLogs.endpoint,
      )
      .orderBy(asc(sql`min(${apiUsageLogs.createdAt})`));

    return rows.map((r) => ({
      workflowRunId: r.workflowRunId ?? null,
      stepKey: r.stepKey ?? null,
      provider: r.provider,
      endpoint: r.endpoint,
      calls: r.calls ?? 0,
      tokensIn: r.tokensIn ?? null,
      tokensOut: r.tokensOut ?? null,
      costUsd: Math.round((r.costUsd ?? 0) * 1_000_000) / 1_000_000,
      createdAt: r.createdAt,
    }));
  }

  /** Export raw logs as CSV string. */
  async exportCsv(filters: ApiUsageSummaryFilters): Promise<string> {
    const conditions = [
      gte(apiUsageLogs.createdAt, filters.from),
      lte(apiUsageLogs.createdAt, filters.to),
      ...(filters.orgId ? [eq(apiUsageLogs.organizationId, filters.orgId)] : []),
    ];

    const rows = await this.db.db
      .select({
        id: apiUsageLogs.id,
        organizationId: apiUsageLogs.organizationId,
        projectId: apiUsageLogs.projectId,
        workflowRunId: apiUsageLogs.workflowRunId,
        stepKey: apiUsageLogs.stepKey,
        provider: apiUsageLogs.provider,
        endpoint: apiUsageLogs.endpoint,
        tokensIn: apiUsageLogs.tokensIn,
        tokensOut: apiUsageLogs.tokensOut,
        costUsd: apiUsageLogs.costUsd,
        durationMs: apiUsageLogs.durationMs,
        success: apiUsageLogs.success,
        createdAt: apiUsageLogs.createdAt,
      })
      .from(apiUsageLogs)
      .where(and(...conditions))
      .orderBy(asc(apiUsageLogs.createdAt))
      .limit(50_000);

    const header = 'id,organizationId,projectId,workflowRunId,stepKey,provider,endpoint,tokensIn,tokensOut,costUsd,durationMs,success,createdAt';
    const csvRows = rows.map((r) =>
      [
        r.id,
        r.organizationId,
        r.projectId ?? '',
        r.workflowRunId ?? '',
        r.stepKey ?? '',
        r.provider,
        r.endpoint,
        r.tokensIn ?? '',
        r.tokensOut ?? '',
        r.costUsd,
        r.durationMs ?? '',
        r.success,
        r.createdAt.toISOString(),
      ].join(','),
    );

    return [header, ...csvRows].join('\n');
  }
}
