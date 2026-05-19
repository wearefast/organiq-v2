import { Controller, Get, Post, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LlmAuditService } from './llm-audit.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('llm-audit')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/audit/llm')
export class LlmAuditController {
  constructor(private readonly llmAuditService: LlmAuditService) {}

  @Post('run')
  async runAudit(
    @Param('projectId') projectId: string,
    @Query('url') url?: string,
  ) {
    if (!url) {
      throw new BadRequestException('Query param "url" is required');
    }
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }
    return this.llmAuditService.runAudit(projectId, url);
  }

  @Get('latest')
  async getLatest(@Param('projectId') projectId: string) {
    return this.llmAuditService.getLatestAudit(projectId);
  }

  @Get('history')
  async getHistory(@Param('projectId') projectId: string) {
    return this.llmAuditService.getAuditHistory(projectId);
  }
}
