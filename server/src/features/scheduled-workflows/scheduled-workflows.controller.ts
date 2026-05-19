import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength, IsIn } from 'class-validator';
import { ScheduledWorkflowsService } from './scheduled-workflows.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

class CreateScheduledWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  agentType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  scheduleCron: string;

  @IsString()
  @IsIn(['email', 'slack'])
  deliveryChannel: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  deliveryTarget: string;
}

class UpdateScheduledWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scheduleCron?: string;

  @IsOptional()
  @IsString()
  @IsIn(['email', 'slack'])
  deliveryChannel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryTarget?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('projects/:projectId/scheduled-workflows')
@UseGuards(ClerkGuard, OrgMembershipGuard)
export class ScheduledWorkflowsController {
  constructor(private readonly service: ScheduledWorkflowsService) {}

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() body: CreateScheduledWorkflowDto,
    @Req() req: any,
  ) {
    return this.service.create({
      ...body,
      projectId,
      organizationId: req.org.id,
    });
  }

  @Get()
  async findAll(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Get(':workflowId')
  async findOne(@Param('workflowId') workflowId: string) {
    return this.service.findById(workflowId);
  }

  @Patch(':workflowId')
  async update(
    @Param('workflowId') workflowId: string,
    @Body() body: UpdateScheduledWorkflowDto,
  ) {
    return this.service.update(workflowId, body);
  }

  @Delete(':workflowId')
  async remove(@Param('workflowId') workflowId: string) {
    return this.service.delete(workflowId);
  }

  @Get(':workflowId/history')
  async getHistory(
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getRunHistory(workflowId, limit ? parseInt(limit, 10) : 20);
  }
}
