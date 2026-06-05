import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { OnDemandAgentsService } from './on-demand-agents.service';
import { AgentRouterService } from './agent-router.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

class RunAgentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt: string;

  @IsOptional()
  @IsString()
  agentType?: string;
}

@Controller('projects/:projectId/agents')
@UseGuards(ClerkGuard, OrgMembershipGuard)
export class OnDemandAgentsController {
  constructor(
    private readonly agentsService: OnDemandAgentsService,
    private readonly routerService: AgentRouterService,
  ) {}

  @Post('run')
  // Each on-demand run invokes Claude — stricter limit to protect Anthropic spend.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async runAgent(
    @Param('projectId') projectId: string,
    @Body() dto: RunAgentDto,
    @Req() req: any,
  ) {
    return this.agentsService.run({
      projectId,
      organizationId: req.org.id,
      prompt: dto.prompt,
      agentType: dto.agentType,
    });
  }

  @Get('history')
  async getHistory(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentsService.getHistory(projectId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('types')
  getAgentTypes() {
    return this.routerService.getAllTypes();
  }
}
