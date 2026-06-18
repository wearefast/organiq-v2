import { Controller, Post, Get, Query, Param, Body, UseGuards, HttpCode, HttpStatus, Req, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { CreditsService } from '../credits/credits.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AddCreditsDto } from './dto/add-credits.dto';

/**
 * Internal platform admin API.
 * All routes require ClerkGuard + SuperAdminGuard.
 * NOT exposed in customer-facing Swagger docs.
 *
 * Protected by SUPER_ADMIN_CLERK_IDS env var (comma-separated Clerk user IDs).
 */
@ApiTags('internal')
@UseGuards(ClerkGuard, SuperAdminGuard)
@Controller('internal')
export class InternalController {
  private readonly logger = new Logger(InternalController.name);

  constructor(
    private readonly creditsService: CreditsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Add credits to an organization.
   * Used by platform admins to top up org balances.
   */
  @Post('orgs/:orgId/credits')
  @HttpCode(HttpStatus.OK)
  async addCredits(@Param('orgId') orgId: string, @Body() dto: AddCreditsDto, @Req() req: any) {
    const performedBy: string = req.user?.clerkUserId ?? 'unknown';
    this.logger.log(
      JSON.stringify({
        event: 'super_admin_credit_grant',
        performedBy,
        organizationId: orgId,
        amount: dto.amount,
        type: dto.type ?? 'bonus',
      }),
    );
    await this.creditsService.credit({
      organizationId: orgId,
      amount: dto.amount,
      type: dto.type ?? 'bonus',
      description: `${dto.description ?? 'Platform admin credit grant'} [by ${performedBy}]`,
    });
    const [balance, ledger] = await Promise.all([
      this.creditsService.getBalance(orgId),
      this.creditsService.getTransactions(orgId, 20),
    ]);
    return { balance, ledger };
  }

  /**
   * Get an org's current credit balance and recent ledger entries.
   */
  @Get('orgs/:orgId/credits')
  async getBalance(@Param('orgId') orgId: string) {
    const [balance, ledger] = await Promise.all([
      this.creditsService.getBalance(orgId),
      this.creditsService.getTransactions(orgId, 20),
    ]);
    return { balance, ledger };
  }

  /**
   * List all organizations — for the platform admin dashboard.
   * Capped at `limit` rows (default 200, max 500).
   */
  @Get('orgs')
  listOrgs(@Query('limit') limitStr?: string) {
    const limit = Math.min(parseInt(limitStr ?? '200', 10) || 200, 500);
    return this.organizationsService.findAll(limit);
  }

  /**
   * Get a single organization's detail.
   */
  @Get('orgs/:orgId')
  getOrg(@Param('orgId') orgId: string) {
    return this.organizationsService.findById(orgId);
  }
}
