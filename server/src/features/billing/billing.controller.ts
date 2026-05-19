import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Headers,
  UseGuards,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { IsString, IsNotEmpty, IsIn, IsInt, Min, Max } from 'class-validator';
import { BillingService } from './billing.service';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';

class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['pro', 'agency', 'enterprise'])
  plan: 'pro' | 'agency' | 'enterprise';

  @IsString()
  @IsNotEmpty()
  successUrl: string;

  @IsString()
  @IsNotEmpty()
  cancelUrl: string;
}

class CreateCreditPurchaseDto {
  @IsInt()
  @Min(50)
  @Max(50000)
  credits: number;

  @IsString()
  @IsNotEmpty()
  successUrl: string;

  @IsString()
  @IsNotEmpty()
  cancelUrl: string;
}

class CreatePortalDto {
  @IsString()
  @IsNotEmpty()
  returnUrl: string;
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** Stripe webhook — no auth guard, verified via signature */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody;
    if (!payload) throw new BadRequestException('Missing raw body');
    return this.billingService.handleWebhook(payload, signature);
  }

  @ApiBearerAuth()
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Post(':organizationId/checkout')
  async createCheckout(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckoutSession({
      organizationId,
      plan: dto.plan,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  @ApiBearerAuth()
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Post(':organizationId/purchase-credits')
  async purchaseCredits(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateCreditPurchaseDto,
  ) {
    return this.billingService.createCreditPurchaseSession({
      organizationId,
      credits: dto.credits,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  @ApiBearerAuth()
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Post(':organizationId/portal')
  async createPortal(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreatePortalDto,
  ) {
    return this.billingService.createPortalSession(organizationId, dto.returnUrl);
  }

  @ApiBearerAuth()
  @UseGuards(ClerkGuard, OrgMembershipGuard)
  @Get(':organizationId/subscription')
  async getSubscription(@Param('organizationId') organizationId: string) {
    return this.billingService.getSubscription(organizationId);
  }
}
