import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContentService } from './content.service';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOperation({ summary: 'List content pieces' })
  async findAll(@Query('status') status?: string) {
    return this.contentService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content piece' })
  async findOne(@Param('id') id: string) {
    return this.contentService.findOne(id);
  }

  @Post('generate-brief/:keywordId')
  @ApiOperation({ summary: 'Generate content brief for keyword' })
  async generateBrief(@Param('keywordId') keywordId: string) {
    return this.contentService.generateBrief(keywordId);
  }

  @Post('generate-article/:keywordId')
  @ApiOperation({ summary: 'Generate full article for keyword' })
  async generateArticle(@Param('keywordId') keywordId: string) {
    return this.contentService.generateArticle(keywordId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update content status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.contentService.updateStatus(id, status);
  }
}
