import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LlmTrafficService, IngestPayload } from './llm-traffic.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('llm-traffic')
@Controller()
export class LlmTrafficController {
  constructor(private readonly trafficService: LlmTrafficService) {}

  /**
   * Public ingest endpoint — called by pulse-tracker.js from customer sites.
   * No auth guard (CORS-allowed, rate-limited in service).
   */
  @Post('traffic/ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingest(@Body() body: IngestPayload) {
    if (!body.projectId || !body.engine || !body.landingPage || !body.sessionId) {
      throw new BadRequestException('Missing required fields: projectId, engine, landingPage, sessionId');
    }

    // Input length validation — prevent oversized payloads from untrusted sources
    if (body.sessionId.length > 128) throw new BadRequestException('sessionId too long');
    if (body.landingPage.length > 2048) throw new BadRequestException('landingPage too long');
    if (body.engine.length > 50) throw new BadRequestException('engine too long');
    if (body.projectId.length > 36) throw new BadRequestException('projectId too long');
    if (body.referrer && body.referrer.length > 2048) throw new BadRequestException('referrer too long');
    if (body.country && body.country.length > 10) throw new BadRequestException('country too long');
    if (body.device && body.device.length > 50) throw new BadRequestException('device too long');

    const result = await this.trafficService.ingest(body);
    return result;
  }

  /**
   * Authenticated dashboard endpoints
   */
  @Get('projects/:projectId/traffic/overview')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  async getOverview(
    @Param('projectId') projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const end = endDate ?? new Date().toISOString().slice(0, 10);
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return this.trafficService.getOverview(projectId, start, end);
  }

  @Get('projects/:projectId/traffic/engines')
  @ApiBearerAuth()
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  async getEngines() {
    // Return supported engines list for UI
    return {
      engines: [
        { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' },
        { id: 'perplexity', name: 'Perplexity', color: '#20B2AA' },
        { id: 'claude', name: 'Claude', color: '#D97706' },
        { id: 'gemini', name: 'Gemini', color: '#4285F4' },
        { id: 'copilot', name: 'Bing Copilot', color: '#00BCF2' },
        { id: 'you', name: 'You.com', color: '#6366F1' },
        { id: 'phind', name: 'Phind', color: '#22C55E' },
        { id: 'kagi', name: 'Kagi', color: '#FBBF24' },
        { id: 'neeva', name: 'Neeva', color: '#8B5CF6' },
        { id: 'brave-search', name: 'Brave Search', color: '#FB542B' },
        { id: 'meta-ai', name: 'Meta AI', color: '#0668E1' },
        { id: 'cohere', name: 'Cohere', color: '#39594D' },
      ],
    };
  }
}
