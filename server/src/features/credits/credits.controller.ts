import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

@ApiTags('credits')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('credits')
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Get(':organizationId/balance')
  async getBalance(@Param('organizationId') organizationId: string) {
    const balance = await this.creditsService.getBalance(organizationId);
    return { balance };
  }

  @Get(':organizationId/transactions')
  async getTransactions(@Param('organizationId') organizationId: string) {
    return this.creditsService.getTransactions(organizationId);
  }

  @Post(':organizationId/purchase')
  async purchase(
    @Param('organizationId') organizationId: string,
    @Body() body: { amount: number; description?: string },
  ) {
    return this.creditsService.credit({
      organizationId,
      amount: body.amount,
      type: 'purchase',
      description: body.description || `Purchased ${body.amount} credits`,
    });
  }
}
