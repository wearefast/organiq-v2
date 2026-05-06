import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../shared/database/database.service';
import {
  competitorBucketEnum,
  competitorStatusEnum,
  contentPieces,
  contentGapImports,
  keywordProjects,
  keywords,
  keywordWorkflowApprovals,
  keywordWorkflowArtifacts,
  keywordWorkflowJobs,
  keywordWorkflowRuns,
  projectCompetitorMetrics,
  projectCompetitors,
  topicalMaps,
} from '../../db/schema';
import { CreateKeywordProjectDto } from './dto/create-keyword-project.dto';
import { CreateKeywordWorkflowDto } from './dto/create-keyword-workflow.dto';

const WORKFLOW_STEP_SEQUENCE = [
  'business-profile',
  'seed-keywords',
  'serp-niche-map',
  'competitor-buckets',
  'competitor-metrics',
  'phase1-baseline',
  'method01-competitor-pages',
  'method02-seed-expansion',
  'method03-content-gap-import',
  'consolidated-keywords',
  'topical-map',
  'content-brief',
  'content-article',
] as const;

@Injectable()
export class KeywordsService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue('keyword-queue') private readonly keywordQueue: Queue,
  ) {}

  private parseDelimitedLine(line: string, delimiter: string) {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];

      if (character === '"') {
        const nextCharacter = line[index + 1];

        if (insideQuotes && nextCharacter === '"') {
          currentValue += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }

        continue;
      }

      if (character === delimiter && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
        continue;
      }

      currentValue += character;
    }

    values.push(currentValue.trim());
    return values;
  }

  private getNextWorkflowStepKey(stepKey: string) {
    const currentIndex = WORKFLOW_STEP_SEQUENCE.indexOf(stepKey as (typeof WORKFLOW_STEP_SEQUENCE)[number]);

    if (currentIndex === -1) {
      return null;
    }

    return WORKFLOW_STEP_SEQUENCE[currentIndex + 1] ?? null;
  }

  private parseContentGapImport(rawImport: string) {
    const lines = rawImport
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      throw new BadRequestException('Content Gap import is empty.');
    }

    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(',') ? ',' : null;

    if (!delimiter) {
      return {
        format: 'plain-text',
        headers: ['value'],
        rows: lines.map((line) => ({ value: line })),
      };
    }

    const rawHeaders = this.parseDelimitedLine(lines[0], delimiter);
    const headers = rawHeaders.map((header, index) => header || `column_${index + 1}`);
    const rows = lines
      .slice(1)
      .map((line) => {
        const values = this.parseDelimitedLine(line, delimiter);

        return headers.reduce<Record<string, string>>((record, header, index) => {
          record[header] = values[index] ?? '';
          return record;
        }, {});
      })
      .filter((row) => Object.values(row).some((value) => value.length > 0));

    if (rows.length === 0) {
      throw new BadRequestException('Content Gap import must include at least one data row.');
    }

    return {
      format: delimiter === '\t' ? 'tsv' : 'csv',
      headers,
      rows,
    };
  }

  async createProject(userId: string, dto: CreateKeywordProjectDto) {
    const [project] = await this.database.db
      .insert(keywordProjects)
      .values({
        userId,
        name: dto.name,
        websiteUrl: dto.websiteUrl,
        seedKeywords: dto.seedKeywords,
      })
      .returning();
    return project;
  }

  async findAllProjects(userId: string) {
    const projects = await this.database.db
      .select()
      .from(keywordProjects)
      .where(eq(keywordProjects.userId, userId))
      .orderBy(desc(keywordProjects.createdAt));

    if (projects.length === 0) return [];

    const workflows = await this.database.db
      .select()
      .from(keywordWorkflowRuns)
      .where(inArray(keywordWorkflowRuns.projectId, projects.map((project) => project.id)))
      .orderBy(desc(keywordWorkflowRuns.createdAt));

    const workflowsByProject = workflows.reduce<Record<string, typeof workflows>>((acc, workflow) => {
      const existing = acc[workflow.projectId] ?? [];
      existing.push(workflow);
      acc[workflow.projectId] = existing;
      return acc;
    }, {});

    return projects.map((project) => ({
      ...project,
      workflows: workflowsByProject[project.id] ?? [],
    }));
  }

  async getProject(id: string) {
    const [project] = await this.database.db
      .select()
      .from(keywordProjects)
      .where(eq(keywordProjects.id, id));
    if (!project) throw new NotFoundException('Keyword project not found');

    const kws = await this.database.db
      .select()
      .from(keywords)
      .where(eq(keywords.projectId, id))
      .orderBy(desc(keywords.searchVolume));

    return { ...project, keywords: kws };
  }

  async getKeywords(projectId: string) {
    return this.database.db
      .select()
      .from(keywords)
      .where(eq(keywords.projectId, projectId))
      .orderBy(desc(keywords.searchVolume));
  }

  private async getWorkflowRunOrThrow(projectId: string, workflowId: string) {
    const [workflowRun] = await this.database.db
      .select()
      .from(keywordWorkflowRuns)
      .where(
        and(
          eq(keywordWorkflowRuns.id, workflowId),
          eq(keywordWorkflowRuns.projectId, projectId),
        ),
      );

    if (!workflowRun) throw new NotFoundException('Keyword workflow not found');
    return workflowRun;
  }

  private async getLatestArtifactOrThrow(workflowId: string, stepKey: string) {
    const [artifact] = await this.database.db
      .select()
      .from(keywordWorkflowArtifacts)
      .where(
        and(
          eq(keywordWorkflowArtifacts.workflowRunId, workflowId),
          eq(keywordWorkflowArtifacts.stepKey, stepKey),
        ),
      )
      .orderBy(desc(keywordWorkflowArtifacts.version), desc(keywordWorkflowArtifacts.createdAt))
      .limit(1);

    if (!artifact) throw new NotFoundException('Workflow checkpoint artifact not found');
    return artifact;
  }

  private async getArtifactApprovals(artifactId: string) {
    return this.database.db
      .select()
      .from(keywordWorkflowApprovals)
      .where(eq(keywordWorkflowApprovals.artifactId, artifactId))
      .orderBy(desc(keywordWorkflowApprovals.reviewedAt));
  }

  private async getAggregatedWorkflowStatus(workflowId: string) {
    const artifacts = await this.database.db
      .select({
        stepKey: keywordWorkflowArtifacts.stepKey,
        status: keywordWorkflowArtifacts.status,
      })
      .from(keywordWorkflowArtifacts)
      .where(eq(keywordWorkflowArtifacts.workflowRunId, workflowId))
      .orderBy(desc(keywordWorkflowArtifacts.createdAt), desc(keywordWorkflowArtifacts.version));

    if (artifacts.length === 0) {
      return 'DRAFT' as const;
    }

    const latestStatusesByStep = new Map<string, string>();

    for (const artifact of artifacts) {
      if (!latestStatusesByStep.has(artifact.stepKey)) {
        latestStatusesByStep.set(artifact.stepKey, artifact.status);
      }
    }

    const latestStatuses = Array.from(latestStatusesByStep.values());

    if (latestStatuses.includes('REJECTED')) {
      return 'FAILED' as const;
    }

    if (latestStatuses.includes('REVISION_REQUESTED')) {
      return 'REVISION_REQUESTED' as const;
    }

    if (latestStatuses.includes('AWAITING_APPROVAL')) {
      return 'AWAITING_APPROVAL' as const;
    }

    if (latestStatuses.every((status) => status === 'APPROVED')) {
      return 'APPROVED' as const;
    }

    return 'DRAFT' as const;
  }

  private inferKeywordClassification(keyword: string, sourceMethods: string[]) {
    const normalizedKeyword = keyword.toLowerCase();

    if (
      /^(how|what|why|when|where|who)\b/.test(normalizedKeyword) ||
      /\b(guide|tips|examples|checklist|template|best practices|faq|faqs)\b/.test(normalizedKeyword)
    ) {
      return {
        intent: 'INFORMATIONAL' as const,
        funnel: 'TOFU' as const,
      };
    }

    if (/\b(vs|compare|comparison|alternatives|review|reviews)\b/.test(normalizedKeyword)) {
      return {
        intent: 'COMMERCIAL' as const,
        funnel: 'MOFU' as const,
      };
    }

    if (
      /\b(price|pricing|cost|quote|agency|service|services|company|hire|consultant|experts?)\b/.test(normalizedKeyword) ||
      sourceMethods.includes('method01-competitor-pages') ||
      sourceMethods.includes('method03-content-gap-import')
    ) {
      return {
        intent: 'COMMERCIAL' as const,
        funnel: 'MOFU' as const,
      };
    }

    return {
      intent: 'COMMERCIAL' as const,
      funnel: 'MOFU' as const,
    };
  }

  private async persistApprovedConsolidatedKeywords(
    workflowRun: Awaited<ReturnType<KeywordsService['getWorkflowRunOrThrow']>>,
    artifact: { id: string; version: number; payload: Record<string, unknown> },
  ) {
    const consolidatedKeywords = Array.isArray(artifact.payload.consolidatedKeywords)
      ? artifact.payload.consolidatedKeywords
      : [];

    const persistedKeywords = consolidatedKeywords
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const keywordRecord = entry as Record<string, unknown>;
        const keyword = typeof keywordRecord.keyword === 'string' ? keywordRecord.keyword.trim() : '';
        const dedupeStatus = typeof keywordRecord.dedupeStatus === 'string' ? keywordRecord.dedupeStatus : 'KEPT';

        if (!keyword || dedupeStatus !== 'KEPT') {
          return null;
        }

        const sourceMethods = Array.isArray(keywordRecord.sourceMethods)
          ? keywordRecord.sourceMethods.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];
        const sourceArtifactIds = Array.isArray(keywordRecord.sourceArtifactIds)
          ? keywordRecord.sourceArtifactIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];
        const inferredClassification = this.inferKeywordClassification(keyword, sourceMethods);
        const parentTopic =
          typeof keywordRecord.parentTopic === 'string' && keywordRecord.parentTopic.trim().length > 0
            ? keywordRecord.parentTopic.trim()
            : null;
        const explicitIntent =
          typeof keywordRecord.intent === 'string' && keywordRecord.intent.trim().length > 0
            ? keywordRecord.intent.trim().toUpperCase()
            : null;
        const explicitFunnel =
          typeof keywordRecord.funnel === 'string' && keywordRecord.funnel.trim().length > 0
            ? keywordRecord.funnel.trim().toUpperCase()
            : null;
        const inferredNotes =
          explicitIntent && explicitFunnel
            ? null
            : `Intent and funnel were inferred during promotion from approved consolidated artifact v${artifact.version} because the current artifact payload does not store explicit classification fields.`;

        return {
          projectId: workflowRun.projectId,
          workflowRunId: workflowRun.id,
          keyword,
          kd: typeof keywordRecord.kd === 'number' ? keywordRecord.kd : null,
          searchVolume: typeof keywordRecord.searchVolume === 'number' ? keywordRecord.searchVolume : null,
          intent: (explicitIntent ?? inferredClassification.intent) as 'TRANSACTIONAL' | 'COMMERCIAL' | 'INFORMATIONAL' | 'NAVIGATIONAL',
          funnel: (explicitFunnel ?? inferredClassification.funnel) as 'TOFU' | 'MOFU' | 'BOFU',
          targetUrl:
            typeof keywordRecord.targetUrl === 'string' && keywordRecord.targetUrl.trim().length > 0
              ? keywordRecord.targetUrl.trim()
              : null,
          language: workflowRun.language,
          country: workflowRun.country,
          parentTopic,
          sourceMethods,
          sourceArtifactIds: Array.from(new Set([artifact.id, ...sourceArtifactIds])),
          approvalStatus: 'APPROVED' as const,
          dedupeStatus: 'KEPT' as const,
          existingCoverageUrl:
            typeof keywordRecord.existingCoverageUrl === 'string' && keywordRecord.existingCoverageUrl.trim().length > 0
              ? keywordRecord.existingCoverageUrl.trim()
              : null,
          contentType:
            typeof keywordRecord.contentType === 'string' && keywordRecord.contentType.trim().length > 0
              ? keywordRecord.contentType.trim()
              : parentTopic && parentTopic.toLowerCase() === keyword.toLowerCase()
                ? 'pillar'
                : 'cluster',
          notes: inferredNotes,
          lsiKeywords: Array.isArray(keywordRecord.lsiKeywords) ? keywordRecord.lsiKeywords : null,
          status: 'APPROVED' as const,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    await this.database.db.delete(keywords).where(eq(keywords.workflowRunId, workflowRun.id));

    if (persistedKeywords.length === 0) {
      return [];
    }

    return this.database.db.insert(keywords).values(persistedKeywords).returning();
  }

  private async persistApprovedTopicalMap(
    workflowRun: Awaited<ReturnType<KeywordsService['getWorkflowRunOrThrow']>>,
    artifact: { id: string; version: number; payload: Record<string, unknown> },
  ) {
    await this.database.db.delete(topicalMaps).where(eq(topicalMaps.workflowRunId, workflowRun.id));

    const [persistedTopicalMap] = await this.database.db
      .insert(topicalMaps)
      .values({
        projectId: workflowRun.projectId,
        workflowRunId: workflowRun.id,
        name: `Approved topical map (${workflowRun.language.toUpperCase()} / ${workflowRun.country.toUpperCase()})`,
        language: workflowRun.language,
        country: workflowRun.country,
        structure: {
          ...artifact.payload,
          sourceArtifactId: artifact.id,
          sourceArtifactVersion: artifact.version,
          persistedAt: new Date().toISOString(),
        },
      })
      .returning();

    return persistedTopicalMap;
  }

  private async getPersistedWorkflowKeywordOrThrow(
    workflowRun: Awaited<ReturnType<KeywordsService['getWorkflowRunOrThrow']>>,
    targetKeyword: string,
  ) {
    const normalizedTargetKeyword = targetKeyword.trim().toLowerCase();

    if (!normalizedTargetKeyword) {
      throw new BadRequestException('Content promotion requires a target keyword.');
    }

    const workflowKeywords = await this.database.db
      .select()
      .from(keywords)
      .where(eq(keywords.workflowRunId, workflowRun.id));

    const persistedKeyword = workflowKeywords.find(
      (keyword) => keyword.keyword.trim().toLowerCase() === normalizedTargetKeyword,
    );

    if (!persistedKeyword) {
      throw new BadRequestException(
        `Approved workflow keyword "${targetKeyword}" is not available in the persisted keyword ledger.`,
      );
    }

    return persistedKeyword;
  }

  private async persistApprovedContentBrief(
    workflowRun: Awaited<ReturnType<KeywordsService['getWorkflowRunOrThrow']>>,
    artifact: { id: string; version: number; payload: Record<string, unknown> },
  ) {
    const targetKeyword =
      typeof artifact.payload.targetKeyword === 'string' ? artifact.payload.targetKeyword.trim() : '';
    const persistedKeyword = await this.getPersistedWorkflowKeywordOrThrow(workflowRun, targetKeyword);
    const market =
      artifact.payload.market && typeof artifact.payload.market === 'object'
        ? (artifact.payload.market as Record<string, unknown>)
        : null;
    const titleOptions = Array.isArray(artifact.payload.titleOptions)
      ? artifact.payload.titleOptions.filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0,
        )
      : [];
    const persistedBrief = {
      ...artifact.payload,
      sourceArtifactId: artifact.id,
      sourceArtifactVersion: artifact.version,
      persistedAt: new Date().toISOString(),
    };

    const [existingContentPiece] = await this.database.db
      .select()
      .from(contentPieces)
      .where(eq(contentPieces.keywordId, persistedKeyword.id));

    const contentPieceValues = {
      keywordId: persistedKeyword.id,
      workflowRunId: workflowRun.id,
      title: titleOptions[0] ?? targetKeyword,
      brief: persistedBrief,
      body: null,
      language:
        typeof market?.language === 'string' && market.language.trim().length > 0
          ? market.language.trim()
          : workflowRun.language,
      country:
        typeof market?.country === 'string' && market.country.trim().length > 0
          ? market.country.trim()
          : workflowRun.country,
      reviewNotes: null,
      status: 'BRIEF' as const,
    };

    const [persistedContentPiece] = existingContentPiece
      ? await this.database.db
          .update(contentPieces)
          .set(contentPieceValues)
          .where(eq(contentPieces.id, existingContentPiece.id))
          .returning()
      : await this.database.db.insert(contentPieces).values(contentPieceValues).returning();

    return persistedContentPiece;
  }

  private async persistApprovedContentArticle(
    workflowRun: Awaited<ReturnType<KeywordsService['getWorkflowRunOrThrow']>>,
    artifact: { id: string; version: number; payload: Record<string, unknown> },
  ) {
    const targetKeyword =
      typeof artifact.payload.targetKeyword === 'string' ? artifact.payload.targetKeyword.trim() : '';
    const persistedKeyword = await this.getPersistedWorkflowKeywordOrThrow(workflowRun, targetKeyword);
    const [existingContentPiece] = await this.database.db
      .select()
      .from(contentPieces)
      .where(eq(contentPieces.keywordId, persistedKeyword.id));

    if (!existingContentPiece) {
      throw new BadRequestException(
        'Approve the content brief so the workflow content piece exists before promoting the article input.',
      );
    }

    const market =
      artifact.payload.market && typeof artifact.payload.market === 'object'
        ? (artifact.payload.market as Record<string, unknown>)
        : null;
    const existingReviewNotes =
      existingContentPiece.reviewNotes && typeof existingContentPiece.reviewNotes === 'object'
        ? (existingContentPiece.reviewNotes as Record<string, unknown>)
        : {};
    const articleTitle =
      typeof artifact.payload.title === 'string' && artifact.payload.title.trim().length > 0
        ? artifact.payload.title.trim()
        : existingContentPiece.title;
    const persistedArticleInput = {
      ...artifact.payload,
      sourceArtifactId: artifact.id,
      sourceArtifactVersion: artifact.version,
      persistedAt: new Date().toISOString(),
    };

    const [persistedContentPiece] = await this.database.db
      .update(contentPieces)
      .set({
        workflowRunId: workflowRun.id,
        title: articleTitle,
        language:
          typeof market?.language === 'string' && market.language.trim().length > 0
            ? market.language.trim()
            : existingContentPiece.language,
        country:
          typeof market?.country === 'string' && market.country.trim().length > 0
            ? market.country.trim()
            : existingContentPiece.country ?? workflowRun.country,
        reviewNotes: {
          ...existingReviewNotes,
          articleInput: persistedArticleInput,
        },
        status: 'DRAFT' as const,
      })
      .where(eq(contentPieces.id, existingContentPiece.id))
      .returning();

    return persistedContentPiece;
  }

  async createWorkflow(projectId: string, dto: CreateKeywordWorkflowDto) {
    const [project] = await this.database.db
      .select({ id: keywordProjects.id })
      .from(keywordProjects)
      .where(eq(keywordProjects.id, projectId));

    if (!project) throw new NotFoundException('Keyword project not found');

    const [workflowRun] = await this.database.db
      .insert(keywordWorkflowRuns)
      .values({
        projectId,
        language: dto.language ?? 'en',
        country: dto.country,
        status: 'DRAFT',
        currentStep: 'business-profile',
        currentCheckpoint: 'business-profile',
      })
      .returning();

    return workflowRun;
  }

  async getWorkflow(projectId: string, workflowId: string) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);

    const artifacts = await this.database.db
      .select()
      .from(keywordWorkflowArtifacts)
      .where(eq(keywordWorkflowArtifacts.workflowRunId, workflowId))
      .orderBy(desc(keywordWorkflowArtifacts.createdAt));

    const approvals = artifacts.length
      ? await this.database.db
          .select()
          .from(keywordWorkflowApprovals)
          .where(inArray(keywordWorkflowApprovals.artifactId, artifacts.map((artifact) => artifact.id)))
      : [];

    const artifactApprovals = approvals.reduce<Record<string, typeof approvals>>((acc, approval) => {
      const existing = acc[approval.artifactId] ?? [];
      existing.push(approval);
      acc[approval.artifactId] = existing;
      return acc;
    }, {});

    const workflowContentGapImports = await this.database.db
      .select()
      .from(contentGapImports)
      .where(eq(contentGapImports.workflowRunId, workflowId))
      .orderBy(desc(contentGapImports.createdAt));

    const workflowCompetitors = await this.database.db
      .select()
      .from(projectCompetitors)
      .where(eq(projectCompetitors.workflowRunId, workflowId))
      .orderBy(desc(projectCompetitors.updatedAt), desc(projectCompetitors.createdAt));

    const competitorMetrics = workflowCompetitors.length
      ? await this.database.db
          .select()
          .from(projectCompetitorMetrics)
          .where(inArray(projectCompetitorMetrics.competitorId, workflowCompetitors.map((competitor) => competitor.id)))
      : [];

    const competitorMetricsById = competitorMetrics.reduce<Record<string, (typeof competitorMetrics)[number]>>((acc, metrics) => {
      acc[metrics.competitorId] = metrics;
      return acc;
    }, {});

    const persistedKeywords = await this.database.db
      .select()
      .from(keywords)
      .where(eq(keywords.workflowRunId, workflowId))
      .orderBy(desc(keywords.searchVolume), desc(keywords.createdAt));

    const persistedTopicalMaps = await this.database.db
      .select()
      .from(topicalMaps)
      .where(eq(topicalMaps.workflowRunId, workflowId))
      .orderBy(desc(topicalMaps.updatedAt), desc(topicalMaps.createdAt));

    const persistedContentPieces = await this.database.db
      .select()
      .from(contentPieces)
      .where(eq(contentPieces.workflowRunId, workflowId))
      .orderBy(desc(contentPieces.createdAt));

    return {
      ...workflowRun,
      contentGapImports: workflowContentGapImports,
      persistedContentPieces,
      persistedKeywords,
      persistedTopicalMaps,
      competitors: workflowCompetitors.map((competitor) => ({
        ...competitor,
        metrics: competitorMetricsById[competitor.id] ?? null,
      })),
      artifacts: artifacts.map((artifact) => ({
        ...artifact,
        approvals: artifactApprovals[artifact.id] ?? [],
      })),
    };
  }

  async createWorkflowCompetitor(
    projectId: string,
    workflowId: string,
    body: {
      domain: string;
      bucket?: (typeof competitorBucketEnum.enumValues)[number];
      status?: (typeof competitorStatusEnum.enumValues)[number];
      rationale?: string;
      notes?: string;
    },
  ) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);
    const domain = body.domain.trim().toLowerCase();

    if (!domain) {
      throw new BadRequestException('Competitor domain is required.');
    }

    const [competitor] = await this.database.db
      .insert(projectCompetitors)
      .values({
        projectId: workflowRun.projectId,
        workflowRunId: workflowRun.id,
        domain,
        bucket: body.bucket ?? 'UNCLASSIFIED',
        status: body.status ?? 'CANDIDATE',
        rationale: body.rationale ?? null,
        notes: body.notes ?? null,
        createdBy: null,
      })
      .returning();

    await this.database.db
      .update(keywordWorkflowRuns)
      .set({
        currentStep: 'competitor-buckets',
        currentCheckpoint: 'competitor-buckets',
        updatedAt: new Date(),
      })
      .where(eq(keywordWorkflowRuns.id, workflowRun.id));

    return competitor;
  }

  async upsertWorkflowCompetitorMetrics(
    projectId: string,
    workflowId: string,
    competitorId: string,
    body: {
      domainRating?: number | null;
      organicTraffic?: number | null;
      organicKeywords?: number | null;
      referringDomains?: number | null;
      backlinks?: number | null;
      topPages?: Record<string, unknown>[];
      capturedAt?: string;
    },
  ) {
    await this.getWorkflowRunOrThrow(projectId, workflowId);

    const [competitor] = await this.database.db
      .select()
      .from(projectCompetitors)
      .where(
        and(
          eq(projectCompetitors.id, competitorId),
          eq(projectCompetitors.workflowRunId, workflowId),
        ),
      );

    if (!competitor) {
      throw new NotFoundException('Workflow competitor not found');
    }

    const metricsValues = {
      domainRating: body.domainRating ?? null,
      organicTraffic: body.organicTraffic ?? null,
      organicKeywords: body.organicKeywords ?? null,
      referringDomains: body.referringDomains ?? null,
      backlinks: body.backlinks ?? null,
      topPages: body.topPages ?? [],
      capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
      updatedAt: new Date(),
    };

    const [existingMetrics] = await this.database.db
      .select()
      .from(projectCompetitorMetrics)
      .where(eq(projectCompetitorMetrics.competitorId, competitor.id));

    const [metrics] = existingMetrics
      ? await this.database.db
          .update(projectCompetitorMetrics)
          .set(metricsValues)
          .where(eq(projectCompetitorMetrics.competitorId, competitor.id))
          .returning()
      : await this.database.db
          .insert(projectCompetitorMetrics)
          .values({
            competitorId: competitor.id,
            ...metricsValues,
          })
          .returning();

    await this.database.db
      .update(keywordWorkflowRuns)
      .set({
        currentStep: 'competitor-metrics',
        currentCheckpoint: 'competitor-metrics',
        updatedAt: new Date(),
      })
      .where(eq(keywordWorkflowRuns.id, workflowId));

    return metrics;
  }

  async createContentGapImport(
    projectId: string,
    workflowId: string,
    body: {
      rawImport: string;
      notes?: string;
    },
  ) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);
    const normalizedImport = this.parseContentGapImport(body.rawImport);

    const [contentGapImport] = await this.database.db
      .insert(contentGapImports)
      .values({
        workflowRunId: workflowRun.id,
        format: normalizedImport.format,
        headers: normalizedImport.headers,
        rows: normalizedImport.rows,
        rowCount: normalizedImport.rows.length,
        notes: body.notes ?? null,
        createdBy: null,
      })
      .returning();

    return contentGapImport;
  }

  async createWorkflowArtifact(
    projectId: string,
    workflowId: string,
    body: {
      stepKey: string;
      summary?: Record<string, unknown>;
      payload: Record<string, unknown>;
    },
  ) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);

    const [latestArtifact] = await this.database.db
      .select()
      .from(keywordWorkflowArtifacts)
      .where(
        and(
          eq(keywordWorkflowArtifacts.workflowRunId, workflowRun.id),
          eq(keywordWorkflowArtifacts.stepKey, body.stepKey),
        ),
      )
      .orderBy(desc(keywordWorkflowArtifacts.version), desc(keywordWorkflowArtifacts.createdAt))
      .limit(1);

    const [artifact] = await this.database.db
      .insert(keywordWorkflowArtifacts)
      .values({
        workflowRunId: workflowRun.id,
        stepKey: body.stepKey,
        version: latestArtifact ? latestArtifact.version + 1 : 1,
        status: 'AWAITING_APPROVAL',
        summary: body.summary ?? null,
        payload: body.payload,
      })
      .returning();

    await this.database.db
      .update(keywordWorkflowRuns)
      .set({
        status: 'AWAITING_APPROVAL',
        currentStep: body.stepKey,
        currentCheckpoint: body.stepKey,
        updatedAt: new Date(),
      })
      .where(eq(keywordWorkflowRuns.id, workflowRun.id));

    return { ...artifact, approvals: [] };
  }

  async getCheckpoint(projectId: string, workflowId: string, stepKey: string) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);
    const artifact = await this.getLatestArtifactOrThrow(workflowRun.id, stepKey);
    const approvals = await this.getArtifactApprovals(artifact.id);

    return {
      workflowId: workflowRun.id,
      stepKey,
      artifact: {
        ...artifact,
        approvals,
      },
    };
  }

  async recordCheckpointDecision(
    projectId: string,
    workflowId: string,
    stepKey: string,
    decision: 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED',
    notes?: string,
  ) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);
    const artifact = await this.getLatestArtifactOrThrow(workflowRun.id, stepKey);
    const nextStepKey = decision === 'APPROVED' ? this.getNextWorkflowStepKey(stepKey) : null;
    const activeStepKey = nextStepKey ?? stepKey;

    const artifactStatusByDecision = {
      APPROVED: 'APPROVED',
      REVISION_REQUESTED: 'REVISION_REQUESTED',
      REJECTED: 'REJECTED',
    } as const;

    await this.database.db.insert(keywordWorkflowApprovals).values({
      artifactId: artifact.id,
      decision,
      notes: notes ?? null,
      reviewedBy: null,
    });

    await this.database.db
      .update(keywordWorkflowArtifacts)
      .set({ status: artifactStatusByDecision[decision] })
      .where(eq(keywordWorkflowArtifacts.id, artifact.id));

    if (decision === 'APPROVED') {
      const promotionArtifact = {
        id: artifact.id,
        version: artifact.version,
        payload: artifact.payload && typeof artifact.payload === 'object' ? (artifact.payload as Record<string, unknown>) : {},
      };

      if (stepKey === 'consolidated-keywords') {
        await this.persistApprovedConsolidatedKeywords(workflowRun, promotionArtifact);
      }

      if (stepKey === 'topical-map') {
        await this.persistApprovedTopicalMap(workflowRun, promotionArtifact);
      }

      if (stepKey === 'content-brief') {
        await this.persistApprovedContentBrief(workflowRun, promotionArtifact);
      }

      if (stepKey === 'content-article') {
        await this.persistApprovedContentArticle(workflowRun, promotionArtifact);
      }
    }

    const workflowStatus = await this.getAggregatedWorkflowStatus(workflowRun.id);

    await this.database.db
      .update(keywordWorkflowRuns)
      .set({
        status: workflowStatus,
        currentCheckpoint: activeStepKey,
        currentStep: activeStepKey,
        updatedAt: new Date(),
      })
      .where(eq(keywordWorkflowRuns.id, workflowRun.id));

    const approvals = await this.getArtifactApprovals(artifact.id);

    return {
      workflowId: workflowRun.id,
      stepKey,
      artifact: {
        ...artifact,
        status: artifactStatusByDecision[decision],
        approvals,
      },
    };
  }

  async triggerDiscovery(projectId: string) {
    await this.keywordQueue.add('keyword-discover', {
      projectId,
      action: 'discover',
    });
    return { message: 'Keyword discovery started' };
  }

  async triggerGapAnalysis(projectId: string) {
    await this.keywordQueue.add('keyword-gap', {
      projectId,
      action: 'gap-analysis',
    });
    return { message: 'Content gap analysis started' };
  }

  // ─── Step Generation ─────────────────────────────────────────

  private static readonly STEP_TO_JOB_MAP: Record<string, { jobName: string; requiredPriorStep: string | null }> = {
    'serp-niche-map': { jobName: 'generate-serp-niche-map', requiredPriorStep: 'seed-keywords' },
    'competitor-buckets': { jobName: 'generate-competitor-discovery', requiredPriorStep: 'seed-keywords' },
    'competitor-metrics': { jobName: 'generate-competitor-metrics', requiredPriorStep: 'competitor-buckets' },
    'phase1-baseline': { jobName: 'generate-phase1-baseline', requiredPriorStep: null },
    'method01-competitor-pages': { jobName: 'generate-method01', requiredPriorStep: 'competitor-metrics' },
    'method02-seed-expansion': { jobName: 'generate-method02', requiredPriorStep: 'seed-keywords' },
  };

  async enqueueStepGeneration(projectId: string, workflowId: string, stepKey: string) {
    const workflowRun = await this.getWorkflowRunOrThrow(projectId, workflowId);
    const mapping = KeywordsService.STEP_TO_JOB_MAP[stepKey];

    if (!mapping) {
      throw new BadRequestException(`Step "${stepKey}" does not support automated generation.`);
    }

    // Build input payload from approved prior artifacts and workflow context
    const inputPayload = await this.buildInputPayload(workflowRun, stepKey, mapping.requiredPriorStep);

    // Insert job record
    const [job] = await this.database.db
      .insert(keywordWorkflowJobs)
      .values({
        workflowRunId: workflowRun.id,
        stepKey,
        jobType: mapping.jobName,
        status: 'PENDING',
        progress: 0,
        inputPayload,
      })
      .returning();

    // Enqueue BullMQ job
    await this.keywordQueue.add(mapping.jobName, {
      jobId: job.id,
      workflowRunId: workflowRun.id,
      projectId,
      stepKey,
      inputPayload,
    });

    return job;
  }

  async getJobStatus(projectId: string, workflowId: string, jobId: string) {
    await this.getWorkflowRunOrThrow(projectId, workflowId);

    const [job] = await this.database.db
      .select()
      .from(keywordWorkflowJobs)
      .where(
        and(
          eq(keywordWorkflowJobs.id, jobId),
          eq(keywordWorkflowJobs.workflowRunId, workflowId),
        ),
      );

    if (!job) throw new NotFoundException('Workflow job not found');
    return job;
  }

  private async buildInputPayload(
    workflowRun: Awaited<ReturnType<KeywordsService['getWorkflowRunOrThrow']>>,
    stepKey: string,
    requiredPriorStep: string | null,
  ): Promise<Record<string, unknown>> {
    const country = workflowRun.country;

    // Get project for websiteUrl
    const [project] = await this.database.db
      .select()
      .from(keywordProjects)
      .where(eq(keywordProjects.id, workflowRun.projectId));

    const clientDomain = project ? new URL(project.websiteUrl).hostname : '';

    // Get approved seed keywords if needed
    let seedKeywords: string[] = [];
    if (requiredPriorStep === 'seed-keywords' || stepKey === 'method02-seed-expansion') {
      const [seedArtifact] = await this.database.db
        .select()
        .from(keywordWorkflowArtifacts)
        .where(
          and(
            eq(keywordWorkflowArtifacts.workflowRunId, workflowRun.id),
            eq(keywordWorkflowArtifacts.stepKey, 'seed-keywords'),
            eq(keywordWorkflowArtifacts.status, 'APPROVED'),
          ),
        )
        .orderBy(desc(keywordWorkflowArtifacts.version))
        .limit(1);

      if (seedArtifact) {
        const payload = seedArtifact.payload as Record<string, unknown>;
        const findings = payload.keyFindings;
        if (Array.isArray(findings)) {
          seedKeywords = findings
            .map((f: unknown) => (typeof f === 'string' ? f : ''))
            .filter(Boolean);
        }
      }

      if (seedKeywords.length === 0 && project?.seedKeywords) {
        seedKeywords = project.seedKeywords as string[];
      }

      if (seedKeywords.length === 0) {
        throw new BadRequestException('No approved seed keywords found. Approve Step 2 first.');
      }
    }

    // Get approved competitor IDs if needed
    let competitorIds: string[] = [];
    if (stepKey === 'competitor-metrics' || stepKey === 'method01-competitor-pages') {
      const approvedCompetitors = await this.database.db
        .select({ id: projectCompetitors.id })
        .from(projectCompetitors)
        .where(
          and(
            eq(projectCompetitors.workflowRunId, workflowRun.id),
            eq(projectCompetitors.status, 'APPROVED'),
          ),
        );

      competitorIds = approvedCompetitors.map(c => c.id);

      if (competitorIds.length === 0) {
        throw new BadRequestException('No approved competitors found. Approve Step 4 first.');
      }
    }

    return {
      seedKeywords,
      clientDomain,
      country,
      competitorIds,
    };
  }
}
