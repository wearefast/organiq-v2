import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { ForumIntelligenceService } from './forum-intelligence.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly forumIntelligence: ForumIntelligenceService,
  ) {}

  @Get()
  async findAll(@Param('projectId') projectId: string) {
    return this.contentService.findAllByProject(projectId);
  }

  @Get('stats')
  async getStats(@Param('projectId') projectId: string) {
    return this.contentService.getStats(projectId);
  }

  @Get('all-images')
  async getAllImages(@Param('projectId') projectId: string) {
    return this.contentService.findAllImagesByProject(projectId);
  }

  // ─── Project Assets ───────────────────────────────────────────

  @Get('project-assets')
  async listProjectAssets(@Param('projectId') projectId: string) {
    return this.contentService.findProjectAssets(projectId);
  }

  @Post('project-assets')
  async uploadProjectAsset(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; mimeType: string; size: number; base64: string },
  ) {
    return this.contentService.createProjectAsset(
      projectId,
      body.name,
      body.mimeType,
      body.size,
      body.base64,
    );
  }

  @Delete('project-assets/:assetId')
  async deleteProjectAsset(
    @Param('projectId') projectId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.contentService.deleteProjectAsset(assetId, projectId);
  }

  @Get('forums')
  async searchForums(
    @Param('projectId') projectId: string,
    @Query('q') q: string,
    @Query('country') country?: string,
  ) {
    return this.contentService.searchForumThreads(projectId, q ?? '', country);
  }

  @Get('forums/opportunities')
  async getForumOpportunities(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.forumIntelligence.getOpportunities(projectId, status);
  }

  @Get('forums/topics')
  async getForumTopics(@Param('projectId') projectId: string) {
    return this.forumIntelligence.getTopics(projectId);
  }

  @Get('forums/stats')
  async getForumStats(@Param('projectId') projectId: string) {
    return this.forumIntelligence.getStats(projectId);
  }

  @Post('forums/topics')
  async addForumTopic(
    @Param('projectId') projectId: string,
    @Body() body: { topic: string },
  ) {
    return this.forumIntelligence.addTopic(projectId, body.topic);
  }

  @Delete('forums/topics/:topicId')
  async removeForumTopic(
    @Param('projectId') projectId: string,
    @Param('topicId') topicId: string,
  ) {
    await this.forumIntelligence.removeTopic(topicId, projectId);
    return { success: true };
  }

  @Patch('forums/opportunities/:oppId/status')
  async updateOpportunityStatus(
    @Param('projectId') projectId: string,
    @Param('oppId') oppId: string,
    @Body() body: { status: 'seen' | 'replied' | 'dismissed' },
  ) {
    await this.forumIntelligence.updateOpportunityStatus(oppId, projectId, body.status);
    return { success: true };
  }

  @Post('forums/scan')
  async triggerForumScan(@Param('projectId') projectId: string) {
    const count = await this.forumIntelligence.scanProject(projectId);
    return { newOpportunities: count };
  }

  @Post('forums/enrich')
  async enrichForumDates(@Param('projectId') projectId: string) {
    // Fire-and-forget: enrichment scrapes many URLs and takes minutes.
    // Return immediately so the load balancer doesn't time out.
    void this.forumIntelligence.enrichMissingDates(projectId);
    return { status: 'enrichment_started' };
  }

  @Get(':id')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.findById(id, projectId);
  }

  @Get(':id/images')
  async getImages(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.findImagesByContentPiece(id, projectId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      workflowRunId?: string;
      keywordId?: string;
      type: 'brief' | 'article';
      title: string;
      briefData?: unknown;
      articleData?: unknown;
      scores?: unknown;
      wordCount?: number;
    },
  ) {
    return this.contentService.create({ projectId, ...body });
  }

  @Post('bulk')
  async bulkCreate(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      items: Array<{
        workflowRunId?: string;
        keywordId?: string;
        type: 'brief' | 'article';
        title: string;
        briefData?: unknown;
      }>;
    },
  ) {
    return this.contentService.bulkCreate(projectId, body.items);
  }

  @Patch(':id')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      status?: 'draft' | 'review' | 'approved' | 'published';
      briefData?: unknown;
      articleData?: unknown;
      scores?: unknown;
      wordCount?: number;
    },
  ) {
    return this.contentService.update(id, projectId, body);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { status: 'draft' | 'review' | 'approved' | 'published' },
  ) {
    return this.contentService.updateStatus(id, projectId, body.status);
  }

  @Patch(':id/schedule')
  async schedule(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { scheduledPublishAt: string | null },
  ) {
    const date = body.scheduledPublishAt ? new Date(body.scheduledPublishAt) : null;
    return this.contentService.scheduleContent(id, projectId, date);
  }

  @Delete(':id')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.remove(id, projectId);
  }

  @Post('generate-from-map')
  async generateFromTopicalMap(
    @Param('projectId') projectId: string,
    @Body() body: { topicalMapId: string; workflowRunId?: string },
  ) {
    return this.contentService.generateFromTopicalMap(
      projectId,
      body.topicalMapId,
      body.workflowRunId,
    );
  }
}
