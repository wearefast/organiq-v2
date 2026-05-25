import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
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
  async runAudit(@Param('projectId') projectId: string) {
    return this.llmAuditService.runAudit(projectId);
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
