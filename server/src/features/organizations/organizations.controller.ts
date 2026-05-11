import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { name?: string; slug?: string }) {
    return this.organizationsService.update(id, body);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string) {
    return this.organizationsService.getMembers(id);
  }
}
