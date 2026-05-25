import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PromptVisibilityService, CreatePromptInput } from './prompt-visibility.service';
import { SUPPORTED_ENGINES } from './engine-query.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('prompt-visibility')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects/:projectId/prompts')
export class PromptVisibilityController {
  constructor(private readonly service: PromptVisibilityService) {}

  @Get()
  async getPrompts(@Param('projectId') projectId: string) {
    return this.service.getPrompts(projectId);
  }

  @Post()
  async createPrompt(
    @Param('projectId') projectId: string,
    @Body() body: CreatePromptInput,
  ) {
    if (!body.promptText?.trim()) {
      throw new BadRequestException('promptText is required');
    }
    return this.service.createPrompt(projectId, body);
  }

  @Delete(':promptId')
  async deletePrompt(@Param('promptId') promptId: string) {
    await this.service.deletePrompt(promptId);
    return { success: true };
  }

  @Patch(':promptId/toggle')
  async togglePrompt(
    @Param('promptId') promptId: string,
    @Body() body: { isActive: boolean },
  ) {
    await this.service.togglePrompt(promptId, body.isActive);
    return { success: true };
  }

  @Get(':promptId/history')
  async getHistory(@Param('promptId') promptId: string) {
    return this.service.getPromptHistory(promptId);
  }

  @Get('overview')
  async getOverview(@Param('projectId') projectId: string) {
    return this.service.getOverview(projectId);
  }

  @Get('suggestions')
  async getSuggestions(@Param('projectId') projectId: string) {
    return this.service.generateSuggestions(projectId);
  }

  @Get('engines')
  getEngines() {
    return { engines: SUPPORTED_ENGINES };
  }
}
