import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  // Clerk webhook will be re-added when auth is integrated.
  // This controller is kept as a placeholder for incoming webhooks.
}
