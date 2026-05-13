import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  async findAll(@Param('projectId') projectId: string) {
    return this.contentService.findAllByProject(projectId);
  }

  @Get('stats')
  async getStats(@Param('projectId') projectId: string) {
    return this.contentService.getStats(projectId);
  }

  @Get(':id')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.contentService.findById(id, projectId);
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
