import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KeywordsService } from './keywords.service';
import { CreateKeywordProjectDto } from './dto/create-keyword-project.dto';

@ApiTags('keywords')
@Controller('keywords')
export class KeywordsController {
  constructor(private readonly keywordsService: KeywordsService) {}

  @Post('projects')
  @ApiOperation({ summary: 'Create keyword research project' })
  async createProject(@Body() dto: CreateKeywordProjectDto) {
    // TODO: Extract userId from Clerk JWT
    const userId = 'temp-user-id';
    return this.keywordsService.createProject(userId, dto);
  }

  @Get('projects')
  @ApiOperation({ summary: 'List keyword projects' })
  async findAllProjects() {
    const userId = 'temp-user-id';
    return this.keywordsService.findAllProjects(userId);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get keyword project with keywords' })
  async getProject(@Param('id') id: string) {
    return this.keywordsService.getProject(id);
  }

  @Get('projects/:id/keywords')
  @ApiOperation({ summary: 'Get keywords for a project' })
  async getKeywords(@Param('id') id: string) {
    return this.keywordsService.getKeywords(id);
  }

  @Post('projects/:id/discover')
  @ApiOperation({ summary: 'Trigger keyword discovery (SOP Steps 4-7)' })
  async triggerDiscovery(@Param('id') id: string) {
    return this.keywordsService.triggerDiscovery(id);
  }

  @Post('projects/:id/gap-analysis')
  @ApiOperation({ summary: 'Trigger content gap analysis (SOP Method 3)' })
  async triggerGapAnalysis(@Param('id') id: string) {
    return this.keywordsService.triggerGapAnalysis(id);
  }
}
