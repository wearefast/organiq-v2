import { Injectable, Logger } from '@nestjs/common';
import { eq, and, or, sql, isNull } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import { projectIntelligence, refreshSuggestions } from '../../db/schema';

export interface IntelligenceEntry {
  projectId: string;
  organizationId: string;
  targetKey?: string | null;
  dataType: string;
  data: unknown;
  producedBy: string;
  workflowRunId?: string | null;
}

export interface ContextFilter {
  projectId: string;
  organizationId: string;
  targetKey?: string | null;
}

const FOUNDATION_KEY = '__foundation__';

@Injectable()
export class ProjectIntelligenceService {
  private readonly logger = new Logger(ProjectIntelligenceService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Upsert a single intelligence entry (latest-only semantics).
   * Conflict resolution on UNIQUE(project_id, target_key, data_type).
   */
  async upsert(entry: IntelligenceEntry) {
    const targetKey = entry.targetKey || FOUNDATION_KEY;

    const [result] = await this.db.db
      .insert(projectIntelligence)
      .values({
        projectId: entry.projectId,
        organizationId: entry.organizationId,
        targetKey,
        dataType: entry.dataType,
        data: entry.data,
        producedBy: entry.producedBy,
        workflowRunId: entry.workflowRunId ?? null,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [projectIntelligence.projectId, projectIntelligence.targetKey, projectIntelligence.dataType],
        set: {
          data: sql`EXCLUDED.data`,
          producedBy: sql`EXCLUDED.produced_by`,
          workflowRunId: sql`EXCLUDED.workflow_run_id`,
          version: sql`${projectIntelligence.version} + 1`,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    this.logger.debug(`Upserted intelligence: ${entry.dataType} for project ${entry.projectId} (target: ${targetKey})`);

    // Auto-dismiss any active refresh suggestions for this dataType+target,
    // since we just stored fresh data — the stale warning is no longer relevant.
    const rawTargetKey = entry.targetKey ?? null;
    await this.db.db
      .update(refreshSuggestions)
      .set({ dismissed: true, refreshedAt: new Date() })
      .where(
        and(
          eq(refreshSuggestions.projectId, entry.projectId),
          eq(refreshSuggestions.organizationId, entry.organizationId),
          eq(refreshSuggestions.dataType, entry.dataType),
          eq(refreshSuggestions.dismissed, false),
          rawTargetKey === null
            ? isNull(refreshSuggestions.targetKey)
            : eq(refreshSuggestions.targetKey, rawTargetKey),
        ),
      );

    return result;
  }

  /**
   * Get all intelligence entries for a project.
   */
  async getAll(projectId: string, organizationId: string) {
    return this.db.db.query.projectIntelligence.findMany({
      where: and(
        eq(projectIntelligence.projectId, projectId),
        eq(projectIntelligence.organizationId, organizationId),
      ),
      orderBy: (pi, { desc }) => [desc(pi.updatedAt)],
    });
  }

  /**
   * Get intelligence entries visible for a specific target.
   * Returns: foundation entries + entries for the specified target.
   */
  async getForTarget(projectId: string, organizationId: string, targetKey: string) {
    return this.db.db.query.projectIntelligence.findMany({
      where: and(
        eq(projectIntelligence.projectId, projectId),
        eq(projectIntelligence.organizationId, organizationId),
        or(
          eq(projectIntelligence.targetKey, FOUNDATION_KEY),
          eq(projectIntelligence.targetKey, targetKey),
        ),
      ),
      orderBy: (pi, { desc }) => [desc(pi.updatedAt)],
    });
  }

  /**
   * Assemble full context for a project+target as a structured object.
   * Keys are composite (dataType:target) to avoid collisions when foundation
   * and target-specific entries share the same dataType.
   */
  async assembleContext(filter: ContextFilter) {
    const entries = filter.targetKey
      ? await this.getForTarget(filter.projectId, filter.organizationId, filter.targetKey)
      : await this.getAll(filter.projectId, filter.organizationId);

    const context: Record<string, { data: unknown; updatedAt: Date; version: number; target: string }> = {};

    for (const entry of entries) {
      // Use composite key to prevent collision between foundation + target entries of same dataType
      const contextKey = entry.targetKey === FOUNDATION_KEY
        ? entry.dataType
        : `${entry.dataType}:${entry.targetKey}`;

      context[contextKey] = {
        data: entry.data,
        updatedAt: entry.updatedAt,
        version: entry.version,
        target: entry.targetKey,
      };
    }

    return context;
  }

  /**
   * Render context as XML for injection into agent system prompts.
   */
  renderContextXml(context: Record<string, { data: unknown; updatedAt: Date; version: number; target: string }>): string {
    const entries = Object.entries(context);
    if (entries.length === 0) return '';

    const lines: string[] = ['<project_intelligence>'];

    for (const [contextKey, meta] of entries) {
      // Extract the actual dataType (strip target suffix if present)
      const dataType = contextKey.includes(':') ? contextKey.split(':')[0] : contextKey;
      const escapedType = this.escapeXmlAttr(dataType);
      const escapedTarget = this.escapeXmlAttr(meta.target);
      lines.push(`  <entry type="${escapedType}" target="${escapedTarget}" version="${meta.version}" updated="${meta.updatedAt.toISOString()}">`);
      lines.push(`    ${JSON.stringify(meta.data)}`);
      lines.push('  </entry>');
    }

    lines.push('</project_intelligence>');
    return lines.join('\n');
  }

  /**
   * Create a refresh suggestion (called by the flag_stale_data tool).
   */
  async createRefreshSuggestion(data: {
    projectId: string;
    organizationId: string;
    targetKey?: string | null;
    dataType: string;
    lastUpdated: Date;
    reason: string;
    suggestedBy: string;
  }) {
    const rawTargetKey = data.targetKey ?? null;

    // Deduplicate: if an active suggestion for the same (project, dataType, targetKey)
    // already exists, update its reason/timestamp instead of creating a duplicate.
    const existing = await this.db.db.query.refreshSuggestions.findFirst({
      where: and(
        eq(refreshSuggestions.projectId, data.projectId),
        eq(refreshSuggestions.organizationId, data.organizationId),
        eq(refreshSuggestions.dataType, data.dataType),
        eq(refreshSuggestions.dismissed, false),
        rawTargetKey === null
          ? isNull(refreshSuggestions.targetKey)
          : eq(refreshSuggestions.targetKey, rawTargetKey),
      ),
    });

    if (existing) {
      const [updated] = await this.db.db
        .update(refreshSuggestions)
        .set({ reason: data.reason, suggestedAt: new Date(), lastUpdated: data.lastUpdated })
        .where(eq(refreshSuggestions.id, existing.id))
        .returning();
      return updated;
    }

    const [suggestion] = await this.db.db
      .insert(refreshSuggestions)
      .values({
        projectId: data.projectId,
        organizationId: data.organizationId,
        targetKey: rawTargetKey,
        dataType: data.dataType,
        lastUpdated: data.lastUpdated,
        reason: data.reason,
        suggestedBy: data.suggestedBy,
      })
      .returning();

    return suggestion;
  }

  /**
   * Get active (non-dismissed) refresh suggestions for a project.
   */
  async getActiveRefreshSuggestions(projectId: string, organizationId: string) {
    return this.db.db.query.refreshSuggestions.findMany({
      where: and(
        eq(refreshSuggestions.projectId, projectId),
        eq(refreshSuggestions.organizationId, organizationId),
        eq(refreshSuggestions.dismissed, false),
      ),
      orderBy: (rs, { desc }) => [desc(rs.suggestedAt)],
    });
  }

  /**
   * Dismiss a refresh suggestion. Scoped to organization for authorization.
   */
  async dismissRefreshSuggestion(id: string, organizationId: string, projectId: string) {
    const [updated] = await this.db.db
      .update(refreshSuggestions)
      .set({ dismissed: true })
      .where(and(
        eq(refreshSuggestions.id, id),
        eq(refreshSuggestions.organizationId, organizationId),
        eq(refreshSuggestions.projectId, projectId),
      ))
      .returning();
    return updated ?? null;
  }

  private escapeXmlAttr(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
