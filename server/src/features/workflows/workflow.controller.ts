import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { WorkflowGateway } from './workflow.gateway';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowGateway: WorkflowGateway,
  ) {}

  @Post()
  async createRun(@Body() body: { projectId: string; organizationId: string }) {
    return this.workflowService.createRun(body.projectId, body.organizationId);
  }

  @Post(':id/start')
  async startRun(@Param('id') id: string) {
    return this.workflowService.startRun(id);
  }

  @Post(':id/resume')
  async resumeRun(@Param('id') id: string) {
    return this.workflowService.resumeRun(id);
  }

  @Get('steps/:stepId/tool-calls')
  async getStepToolCalls(@Param('stepId') stepId: string) {
    return this.workflowService.getStepToolCalls(stepId);
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
}
