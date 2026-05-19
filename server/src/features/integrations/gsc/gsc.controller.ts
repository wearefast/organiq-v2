import { Controller, Get, Post, Query, Param, Res, Logger, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { ClerkGuard } from '../../auth/clerk.guard';
import { OrgMembershipGuard } from '../../auth/org-membership.guard';
import { GscService } from './gsc.service';

@Controller('projects/:projectId/gsc')
export class GscController {
  private readonly logger = new Logger(GscController.name);

  constructor(
    private readonly gscService: GscService,
    private readonly config: ConfigService,
  ) {}

  /** Initiate OAuth flow — redirects user to Google consent screen */
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Get('connect')
  connect(
    @Param('projectId') projectId: string,
    @Query('organizationId') organizationId: string,
    @Res() res: Response,
  ) {
    const state = this.gscService.signState({ projectId, organizationId });
    const authUrl = this.gscService.getAuthUrl(state);
    res.redirect(authUrl);
  }

  /** OAuth callback — exchanges code for tokens and saves connection (no auth — Google redirects here) */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') stateRaw: string,
    @Res() res: Response,
  ) {
    try {
      const state = this.gscService.verifyState(stateRaw);
      if (!state || !state.projectId || !state.organizationId) {
        throw new Error('Invalid or tampered OAuth state');
      }

      const tokens = await this.gscService.exchangeCode(code);

      // Default siteUrl — user can update later via settings
      const siteUrl = `sc-domain:${state.projectId}`;
      await this.gscService.saveConnection({
        projectId: state.projectId,
        organizationId: state.organizationId,
        siteUrl,
        tokens,
      });

      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
      res.redirect(`${frontendUrl}/dashboard/projects/${state.projectId}/analytics?gsc=connected`);
    } catch (error) {
      this.logger.error(`GSC OAuth callback failed: ${(error as Error).message}`);
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3001');
      res.redirect(`${frontendUrl}/dashboard/settings?gsc=error`);
    }
  }

  /** Get GSC connection status */
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Get('status')
  async getStatus(@Param('projectId') projectId: string) {
    const conn = await this.gscService.getConnection(projectId);
    if (!conn) return { connected: false };
    return {
      connected: true,
      siteUrl: conn.siteUrl,
      lastSyncAt: conn.lastSyncAt,
      syncStatus: conn.syncStatus,
    };
  }

  /** Get keyword data */
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Get('keywords')
  async getKeywords(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const conn = await this.gscService.getConnection(projectId);
    if (!conn) throw new NotFoundException('No GSC connection for this project');

    return this.gscService.getKeywords(projectId, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  /** Get performance summary (aggregated metrics) */
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Get('summary')
  async getSummary(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const conn = await this.gscService.getConnection(projectId);
    if (!conn) throw new NotFoundException('No GSC connection for this project');

    const end = endDate ?? new Date().toISOString().slice(0, 10);
    const start = startDate ?? new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return this.gscService.getPerformanceSummary(projectId, start, end);
  }
}
