import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KeywordsService } from './keywords.service';
import { CreateKeywordProjectDto } from './dto/create-keyword-project.dto';
import { CreateKeywordWorkflowDto } from './dto/create-keyword-workflow.dto';

@ApiTags('keywords')
@Controller('keywords')
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Post('projects')
  @ApiOperation({ summary: 'Create keyword research project' })
  async createProject(@Body() dto: CreateKeywordProjectDto) {
    // TODO: Extract userId from Clerk JWT
    const userId = 'temp-user-id';
    return this.keywordsService.createProject(userId, dto);
  }

  @Get('projects')
  @ApiOperation({ summary: 'List keyword projects' })
  async findAllProjects() {
    const userId = 'temp-user-id';
    return this.keywordsService.findAllProjects(userId);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get keyword project with keywords' })
  async getProject(@Param('id') id: string) {
    return this.keywordsService.getProject(id);
  }

  @Get('projects/:id/keywords')
  @ApiOperation({ summary: 'Get keywords for a project' })
  async getKeywords(@Param('id') id: string) {
    return this.keywordsService.getKeywords(id);
  }

  @Post('projects/:id/workflows')
  @ApiOperation({ summary: 'Create a keyword workflow run for a project' })
  async createWorkflow(@Param('id') id: string, @Body() dto: CreateKeywordWorkflowDto) {
    return this.keywordsService.createWorkflow(id, dto);
  }

  @Get('projects/:id/workflows/:workflowId')
  @ApiOperation({ summary: 'Get a keyword workflow run with artifacts and approvals' })
  async getWorkflow(@Param('id') id: string, @Param('workflowId') workflowId: string) {
    return this.keywordsService.getWorkflow(id, workflowId);
  }

  @Post('projects/:id/workflows/:workflowId/content-gap-imports')
  @ApiOperation({ summary: 'Create a normalized manual Content Gap import for Method 03' })
  async createContentGapImport(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Body()
    body: {
      rawImport: string;
      notes?: string;
    },
  ) {
    return this.keywordsService.createContentGapImport(id, workflowId, body);
  }

  @Post('projects/:id/workflows/:workflowId/competitors')
  @ApiOperation({ summary: 'Create a structured competitor candidate for the workflow' })
  async createWorkflowCompetitor(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Body()
    body: {
      domain: string;
      bucket?: 'DIRECT' | 'ORGANIC' | 'UNCLASSIFIED';
      status?: 'CANDIDATE' | 'APPROVED' | 'REJECTED';
      rationale?: string;
      notes?: string;
    },
  ) {
    return this.keywordsService.createWorkflowCompetitor(id, workflowId, body);
  }

  @Post('projects/:id/workflows/:workflowId/competitors/:competitorId/metrics')
  @ApiOperation({ summary: 'Create or update structured metrics for a workflow competitor' })
  async upsertWorkflowCompetitorMetrics(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('competitorId') competitorId: string,
    @Body()
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
    return this.keywordsService.upsertWorkflowCompetitorMetrics(id, workflowId, competitorId, body);
  }

  @Post('projects/:id/workflows/:workflowId/artifacts')
  @ApiOperation({ summary: 'Create a workflow artifact version for a workflow step' })
  async createWorkflowArtifact(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Body()
    body: {
      stepKey: string;
      summary?: Record<string, unknown>;
      payload: Record<string, unknown>;
    },
  ) {
    return this.keywordsService.createWorkflowArtifact(id, workflowId, body);
  }

  @Get('projects/:id/workflows/:workflowId/checkpoints/:stepKey')
  @ApiOperation({ summary: 'Get the latest artifact and approvals for a workflow checkpoint' })
  async getCheckpoint(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('stepKey') stepKey: string,
  ) {
    return this.keywordsService.getCheckpoint(id, workflowId, stepKey);
  }

  @Post('projects/:id/workflows/:workflowId/checkpoints/:stepKey/approve')
  @ApiOperation({ summary: 'Approve the latest artifact for a workflow checkpoint' })
  async approveCheckpoint(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('stepKey') stepKey: string,
    @Body() body: { notes?: string },
  ) {
    return this.keywordsService.recordCheckpointDecision(id, workflowId, stepKey, 'APPROVED', body?.notes);
  }

  @Post('projects/:id/workflows/:workflowId/checkpoints/:stepKey/request-revision')
  @ApiOperation({ summary: 'Request revision on the latest artifact for a workflow checkpoint' })
  async requestCheckpointRevision(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('stepKey') stepKey: string,
    @Body() body: { notes?: string },
  ) {
    return this.keywordsService.recordCheckpointDecision(
      id,
      workflowId,
      stepKey,
      'REVISION_REQUESTED',
      body?.notes,
    );
  }

  @Post('projects/:id/workflows/:workflowId/checkpoints/:stepKey/reject')
  @ApiOperation({ summary: 'Reject the latest artifact for a workflow checkpoint' })
  async rejectCheckpoint(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('stepKey') stepKey: string,
    @Body() body: { notes?: string },
  ) {
    return this.keywordsService.recordCheckpointDecision(id, workflowId, stepKey, 'REJECTED', body?.notes);
  }

  @Post('projects/:id/discover')
  @ApiOperation({ summary: 'Trigger keyword discovery (SOP Steps 4-7)' })
  async triggerDiscovery(@Param('id') id: string) {
    return this.keywordsService.triggerDiscovery(id);
  }

  @Post('projects/:id/gap-analysis')
  @ApiOperation({ summary: 'Trigger content gap analysis (SOP Method 3)' })
  async triggerGapAnalysis(@Param('id') id: string) {
    return this.keywordsService.triggerGapAnalysis(id);
  }

  @Post('projects/:id/workflows/:workflowId/steps/:stepKey/generate')
  @ApiOperation({ summary: 'Trigger automated research generation for a workflow step' })
  async generateStep(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('stepKey') stepKey: string,
  ) {
    return this.keywordsService.enqueueStepGeneration(id, workflowId, stepKey);
  }

  @Get('projects/:id/workflows/:workflowId/jobs/:jobId')
  @ApiOperation({ summary: 'Get the status of a workflow generation job' })
  async getJobStatus(
    @Param('id') id: string,
    @Param('workflowId') workflowId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.keywordsService.getJobStatus(id, workflowId, jobId);
  }
}
