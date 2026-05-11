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
import { KeywordsService, BulkKeywordInput } from './keywords.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('keywords')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/keywords')
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    if (status) {
      return this.keywordsService.findByProjectAndStatus(projectId, status);
    }
    return this.keywordsService.findAllByProject(projectId);
  }

  @Get('stats')
  async getStats(@Param('projectId') projectId: string) {
    return this.keywordsService.getStats(projectId);
  }

  @Get(':id')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.keywordsService.findById(id, projectId);
  }

  @Post('bulk')
  async bulkUpsert(
    @Param('projectId') projectId: string,
    @Body() body: { workflowRunId?: string; keywords: BulkKeywordInput[] },
  ) {
    return this.keywordsService.bulkUpsert(
      projectId,
      body.workflowRunId ?? null,
      body.keywords,
    );
  }

  @Patch('status')
  async updateStatus(
    @Param('projectId') projectId: string,
    @Body() body: { keywordIds: string[]; status: string },
  ) {
    return this.keywordsService.updateStatus(
      projectId,
      body.keywordIds,
      body.status as any,
    );
  }

  @Delete(':id')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.keywordsService.remove(id, projectId);
  }
}
