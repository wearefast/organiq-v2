import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('org/:orgId')
  async findAll(@Param('orgId') orgId: string) {
    return this.workspacesService.findAllByOrg(orgId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.workspacesService.findById(id, req.org.id);
  }

  @Post()
  async create(@Body() body: CreateWorkspaceDto) {
    return this.workspacesService.create(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWorkspaceDto,
    @Req() req: any,
  ) {
    return this.workspacesService.update(id, req.org.id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.workspacesService.remove(id, req.org.id);
  }
}
