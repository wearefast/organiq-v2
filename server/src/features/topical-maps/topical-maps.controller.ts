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
import { TopicalMapsService } from './topical-maps.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('topical-maps')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/topical-maps')
export class TopicalMapsController {
  constructor(private readonly topicalMapsService: TopicalMapsService) {}

  @Get()
  async findAll(@Param('projectId') projectId: string) {
    return this.topicalMapsService.findAllByProject(projectId);
  }

  @Get('stats')
  async getStats(@Param('projectId') projectId: string) {
    return this.topicalMapsService.getStats(projectId);
  }

  @Get(':id')
  async findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.topicalMapsService.findById(id, projectId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() body: { name: string; workflowRunId?: string; pillars: unknown; calendar?: unknown },
  ) {
    return this.topicalMapsService.create({
      projectId,
      workflowRunId: body.workflowRunId,
      name: body.name,
      pillars: body.pillars,
      calendar: body.calendar,
    });
  }

  @Patch(':id')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; pillars?: unknown; calendar?: unknown },
  ) {
    return this.topicalMapsService.update(id, projectId, body);
  }

  @Delete(':id')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.topicalMapsService.remove(id, projectId);
  }
}
