import { Controller, Post, Get, Query, Param, Body, UseGuards, HttpCode, HttpStatus, Req, Res, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ClerkGuard } from '../auth/clerk.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { CreditsService } from '../credits/credits.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ApiUsageService } from '../api-usage/api-usage.service';
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
    private readonly apiUsageService: ApiUsageService,
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

  // ─── API Usage Endpoints ─────────────────────────────────

  /** Cost summary: totals + by-provider + by-day, optionally scoped to an org. */
  @Get('api-usage/summary')
  getApiUsageSummary(
    @Query('orgId') orgId?: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const { from, to } = this.parseDateRange(fromStr, toStr);
    return this.apiUsageService.getSummary({ orgId, from, to });
  }

  /** Per-project cost breakdown. */
  @Get('api-usage/by-project')
  getApiUsageByProject(
    @Query('orgId') orgId?: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const { from, to } = this.parseDateRange(fromStr, toStr);
    return this.apiUsageService.getByProject({ orgId, from, to });
  }

  /** Per-step cost breakdown for a specific workflow run. */
  @Get('api-usage/by-run/:runId')
  getApiUsageByRun(@Param('runId') runId: string) {
    return this.apiUsageService.getByWorkflowRun(runId);
  }

  /** Export raw logs as CSV download. */
  @Get('api-usage/export')
  async exportApiUsageCsv(
    @Res() res: Response,
    @Query('orgId') orgId?: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const { from, to } = this.parseDateRange(fromStr, toStr);
    const csv = await this.apiUsageService.exportCsv({ orgId, from, to });
    const filename = `api-usage-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  // ─── Helpers ─────────────────────────────────────────────

  private parseDateRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default: last 30 days
    return { from, to };
  }
}
