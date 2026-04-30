import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('audits')
@Controller('audits')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':id/status')
  @ApiOperation({ summary: 'Poll audit progress' })
  async getStatus(@Param('id') id: string) {
    return this.auditService.getStatus(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all audits' })
  async findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.auditService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit by ID' })
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
