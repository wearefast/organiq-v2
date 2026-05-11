import { Controller, Post, Body, Headers, RawBodyRequest, Req, HttpCode, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { createHmac } from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks')
export class AuthController {
  private readonly processedWebhooks = new Map<string, number>();

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    // Clean up old entries every 10 minutes
    setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000; // 5 min TTL
      for (const [id, ts] of this.processedWebhooks) {
        if (ts < cutoff) this.processedWebhooks.delete(id);
      }
    }, 10 * 60 * 1000);
  }

  @Post('clerk')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() body: any,
  ) {
    const secret = this.config.get<string>('CLERK_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    // Verify webhook signature
    const rawBody = req.rawBody;
    if (rawBody) {
      const payload = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
      const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
      const signature = createHmac('sha256', secretBytes).update(payload).digest('base64');
      const expectedSignatures = svixSignature.split(' ').map((s) => s.replace('v1,', ''));

      if (!expectedSignatures.includes(signature)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Idempotency: reject replayed webhooks
    if (this.processedWebhooks.has(svixId)) {
      return { received: true, duplicate: true };
    }
    this.processedWebhooks.set(svixId, Date.now());

    const { type, data } = body;

    switch (type) {
      case 'organization.created':
        await this.authService.handleOrgCreated({
          id: data.id,
          name: data.name,
          slug: data.slug,
        });
        break;

      case 'organizationMembership.created':
        await this.authService.handleMemberCreated(data);
        break;
    }

    return { received: true };
  }
}
