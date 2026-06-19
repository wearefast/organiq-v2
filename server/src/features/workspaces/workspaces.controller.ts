import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';
import { AccessService } from '../auth/access.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly accessService: AccessService,
  ) {}

  @Get('org/:orgId')
  async findAll(@Param('orgId') orgId: string, @Req() req: any) {
    const role: string = req.member?.role ?? 'user';
    const memberId: string | undefined = req.member?.id;
    const isAdmin = role === 'admin' || role === 'owner';

    if (!isAdmin && memberId) {
      const allowedIds = await this.accessService.getAccessibleWorkspaceIds(memberId, req.org.id);
      // null means org-level grant — full access; otherwise filter by allowed IDs
      if (allowedIds !== null) {
        return this.workspacesService.findAllByOrg(req.org.id, allowedIds);
      }
    }

    return this.workspacesService.findAllByOrg(req.org.id);
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
