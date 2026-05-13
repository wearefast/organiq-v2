import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.reportsService.findAllByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.reportsService.findById(id, projectId);
  }

  @Post('generate')
  generate(
    @Param('projectId') projectId: string,
    @Body() body: { workflowRunId: string; type: 'full_strategy' | 'ai_visibility' | 'keyword_research' | 'content_plan' },
  ) {
    return this.reportsService.generate(projectId, body.workflowRunId, body.type);
  }

  @Get(':id/download')
  async download(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.reportsService.download(id, projectId);
  }

  @Delete(':id')
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.reportsService.remove(id, projectId);
  }
}
