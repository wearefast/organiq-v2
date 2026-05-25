import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('workspace/:workspaceId')
  async findAll(@Param('workspaceId') workspaceId: string) {
    return this.projectsService.findAllByWorkspace(workspaceId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findById(id, req.org.id);
  }

  @Post()
  async create(@Body() body: CreateProjectDto) {
    return this.projectsService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProjectDto,
    @Req() req: any,
  ) {
    return this.projectsService.update(id, req.org.id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.remove(id, req.org.id);
  }

  @Post(':id/refresh-sitemap')
  async refreshSitemap(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.refreshSitemap(id, req.org.id);
  }
}
