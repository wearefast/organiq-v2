import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { BusinessProfileService } from './business-profile.service';
import { ProjectIntelligenceService } from './project-intelligence.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';
import { PlanLimitGuard, PlanLimit } from '../billing/plan-limit.guard';
import { AccessService } from '../auth/access.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects')
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly businessProfileService: BusinessProfileService,
    private readonly intelligenceService: ProjectIntelligenceService,
    private readonly accessService: AccessService,
  ) {}

  @Get('workspace/:workspaceId')
  async findAll(@Param('workspaceId') workspaceId: string, @Req() req: any) {
    const role: string = req.member?.role ?? 'user';
    const memberId: string | undefined = req.member?.id;
    const isAdmin = role === 'admin' || role === 'owner';

    if (!isAdmin && memberId) {
      const allowedIds = await this.accessService.getAccessibleProjectIds(
        memberId,
        req.org.id,
        workspaceId,
      );
      if (allowedIds !== null) {
        return this.projectsService.findAllByWorkspace(workspaceId, allowedIds);
      }
    }

    return this.projectsService.findAllByWorkspace(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findById(id, req.org.id);
  }

  @Post()
  @UseGuards(PlanLimitGuard)
  @PlanLimit('projects')
  async create(@Body() body: CreateProjectDto) {
    const project = await this.projectsService.create(body);
    // Fire-and-forget: generate business profile immediately after project creation
    this.businessProfileService.refresh(project.id, body.organizationId).catch((err: Error) =>
      this.logger.warn(`Auto business profile failed for project ${project.id}: ${err.message}`),
    );
    return project;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
    @Req() req: any,
  ) {
    return this.projectsService.update(id, req.org.id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.remove(id, req.org.id);
  }

  @Post(':id/refresh-sitemap')
  async refreshSitemap(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.refreshSitemap(id, req.org.id);
  }

  @Get(':id/business-profile')
  async getBusinessProfile(@Param('id') id: string, @Req() req: any) {
    return this.businessProfileService.getProfile(id, req.org.id);
  }

  @Post(':id/business-profile/refresh')
  async refreshBusinessProfile(@Param('id') id: string, @Req() req: any) {
    return this.businessProfileService.refresh(id, req.org.id);
  }

  @Patch(':id/business-profile')
  async updateBusinessProfile(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: any,
  ) {
    return this.businessProfileService.update(id, req.org.id, body);
  }

  // ─── Targets ─────────────────────────────────────────────────

  @Get(':id/targets')
  async getTargets(@Param('id') id: string, @Req() req: any) {
    const project = await this.projectsService.findById(id, req.org.id);
    return project.targets ?? [];
  }

  @Patch(':id/targets')
  async updateTargets(
    @Param('id') id: string,
    @Body() body: { targets: Array<{ key: string; domain: string; country: string; language: string }> },
    @Req() req: any,
  ) {
    return this.projectsService.updateTargets(id, req.org.id, body.targets);
  }

  // ─── Intelligence ────────────────────────────────────────────

  @Get(':id/intelligence')
  async getIntelligence(
    @Param('id') id: string,
    @Query('targetKey') targetKey: string | undefined,
    @Req() req: any,
  ) {
    if (targetKey) {
      return this.intelligenceService.getForTarget(id, req.org.id, targetKey);
    }
    return this.intelligenceService.getAll(id, req.org.id);
  }

  @Get(':id/intelligence/refresh-suggestions')
  async getRefreshSuggestions(@Param('id') id: string, @Req() req: any) {
    return this.intelligenceService.getActiveRefreshSuggestions(id, req.org.id);
  }

  @Post(':id/intelligence/refresh-suggestions/:suggestionId/dismiss')
  async dismissRefreshSuggestion(
    @Param('suggestionId') suggestionId: string,
    @Req() req: any,
  ) {
    return this.intelligenceService.dismissRefreshSuggestion(suggestionId, req.org.id);
  }
}
