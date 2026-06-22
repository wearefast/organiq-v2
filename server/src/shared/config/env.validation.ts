import { plainToInstance } from 'class-transformer';
import { IsString, IsOptional, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  CLERK_SECRET_KEY: string;

  @IsString()
  CLERK_WEBHOOK_SECRET: string;

  @IsOptional()
  @IsString()
  CLERK_DOMAIN?: string;

  @IsString()
  OPENAI_API_KEY: string;

  // Required for SEO data in workflow steps
  @IsString()
  AHREFS_API_KEY: string;

  // Required for SERP data in workflows
  @IsString()
  SERPER_API_KEY: string;

  // Required for web scraping
  @IsString()
  FIRECRAWL_API_KEY: string;

  // Required for search volume data
  @IsString()
  DATAFORSEO_LOGIN: string;

  @IsString()
  DATAFORSEO_PASSWORD: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  // Required for all agent LLM calls
  @IsString()
  ANTHROPIC_API_KEY: string;

  @IsOptional()
  @IsString()
  ANTHROPIC_DEFAULT_MODEL?: string;

  @IsOptional()
  @IsString()
  PROMPT_SOURCE?: string;

  @IsOptional()
  @IsString()
  PROMPT_CONSOLE_URL?: string;

  @IsOptional()
  @IsString()
  PROMPT_CONSOLE_API_KEY?: string;

  @IsOptional()
  @IsString()
  GSC_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GSC_CLIENT_SECRET?: string;

  @IsOptional()
  @IsString()
  GSC_REDIRECT_URI?: string;

  @IsOptional()
  @IsString()
  GSC_ENCRYPTION_KEY?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  STRIPE_PRICE_PRO?: string;

  @IsOptional()
  @IsString()
  STRIPE_PRICE_AGENCY?: string;

  @IsOptional()
  @IsString()
  STRIPE_PRICE_ENTERPRISE?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('\n')}`,
    );
  }
  return validatedConfig;
}
