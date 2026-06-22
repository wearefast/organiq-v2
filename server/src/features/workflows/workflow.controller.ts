import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowMaterializerService } from './workflow-materializer.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';
import { PlanLimitGuard, PlanLimit } from '../billing/plan-limit.guard';
import { DatabaseService } from '../../shared/database/database.service';
import { projects } from '../../db/schema';
import { eq } from 'drizzle-orm';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowGateway: WorkflowGateway,
    private readonly materializer: WorkflowMaterializerService,
    private readonly db: DatabaseService,
  ) {}

  @Post('backfill-materialization')
  async backfillMaterialization(@Query('projectId') projectId: string, @Req() req: any) {
    if (!projectId) {
      throw new Error('projectId query parameter is required');
    }
    // CVE-013: Validate the project belongs to the requesting org before allowing backfill
    const project = await this.db.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { organizationId: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    if (project.organizationId !== req.org.id) {
      throw new ForbiddenException('Access denied');
    }
    return this.materializer.backfillProject(projectId);
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  @PlanLimit('workflowsPerMonth')
  // §4.3: Use org from the guard (req.org.id) — never trust organizationId from request body
  async createRun(@Body() body: { projectId: string; targetKey?: string }, @Req() req: any) {
    return this.workflowService.createRun(body.projectId, req.org.id, body.targetKey);
  }

  @Post(':id/start')
  // Starting a run enqueues 17 BullMQ jobs and deducts credits — stricter limit.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async startRun(@Param('id') id: string) {
    return this.workflowService.startRun(id);
  }

  @Post(':id/resume')
  async resumeRun(@Param('id') id: string) {
    return this.workflowService.resumeRun(id);
  }

  @Get('steps/:stepId/tool-calls')
  // CVE-008: Pass org ID for ownership validation — prevents IDOR cross-tenant data access
  async getStepToolCalls(@Param('stepId') stepId: string, @Req() req: any) {
    return this.workflowService.getStepToolCalls(stepId, req.org.id);
  }

  @Get(':id')
  async getRun(@Param('id') id: string) {
    return this.workflowService.getRun(id);
  }

  @Get('project/:projectId')
  async listRuns(@Param('projectId') projectId: string) {
    return this.workflowService.listRuns(projectId);
  }

  @Post(':id/steps/:stepKey/approve')
  async approveStep(
    @Param('id') runId: string,
    @Param('stepKey') stepKey: string,
    @Req() req: { user?: { clerkUserId?: string } },
    @Body() body: { notes?: string },
  ) {
    const reviewerId = req.user?.clerkUserId ?? 'unknown';
    const result = await this.workflowService.handleApproval(
      runId,
      stepKey,
      'approved',
      reviewerId,
      body.notes,
    );

    // Materialize approved artifact into project feature tables (after approval commits)
    await this.materializer.materialize(runId, stepKey);

    // Enqueue downstream steps after approval
    await this.workflowService.enqueuePendingSteps(runId);

    // Emit real-time approval event
    this.workflowGateway.emitStepApproved(runId, stepKey);

    // Check if workflow is fully completed
    const run = await this.workflowService.getRun(runId);
    const allDone = run.steps.every(
      (s: { status: string }) => s.status === 'approved' || s.status === 'completed',
    );
    if (allDone) {
      this.workflowGateway.emitWorkflowCompleted(runId);
    }

    return result;
  }

  @Post(':id/steps/:stepKey/revise')
  async reviseStep(
    @Param('id') runId: string,
    @Param('stepKey') stepKey: string,
    @Req() req: { user?: { clerkUserId?: string } },
    @Body() body: { notes: string },
  ) {
    const reviewerId = req.user?.clerkUserId ?? 'unknown';
    const result = await this.workflowService.handleApproval(
      runId,
      stepKey,
      'revision_requested',
      reviewerId,
      body.notes,
    );

    // Emit real-time revision event
    this.workflowGateway.emitStepRejected(runId, stepKey);

    return result;
  }

  @Post(':id/steps/:stepKey/reject')
  async rejectStep(
    @Param('id') runId: string,
    @Param('stepKey') stepKey: string,
    @Req() req: { user?: { clerkUserId?: string } },
    @Body() body: { notes: string },
  ) {
    const reviewerId = req.user?.clerkUserId ?? 'unknown';
    const result = await this.workflowService.handleApproval(
      runId,
      stepKey,
      'rejected',
      reviewerId,
      body.notes,
    );

    // Emit real-time rejection event
    this.workflowGateway.emitStepRejected(runId, stepKey);

    return result;
  }

  @Get(':id/context')
  async getContext(@Param('id') runId: string) {
    return this.workflowService.getContext(runId);
  }

  @Post(':id/steps/:stepKey/rerun')
  async rerunStep(
    @Param('id') runId: string,
    @Param('stepKey') stepKey: string,
  ) {
    const result = await this.workflowService.rerunStep(runId, stepKey);

    // Emit real-time rerun event
    this.workflowGateway.emitStepRerun(runId, stepKey, result.cascadeReset);

    return result;
  }

  @Patch(':id/steps/:stepKey/artifact')
  async updateArtifact(
    @Param('id') runId: string,
    @Param('stepKey') stepKey: string,
    @Body() body: { data: Record<string, unknown> },
  ) {
    return this.workflowService.updateArtifact(runId, stepKey, body.data);
  }

  @Delete(':id')
  async deleteRun(@Param('id') id: string) {
    return this.workflowService.deleteRun(id);
  }
}
