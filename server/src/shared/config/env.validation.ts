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
  OPENAI_API_KEY: string;

  @IsOptional()
  @IsString()
  AHREFS_API_KEY?: string;

  @IsOptional()
  @IsString()
  SERPER_API_KEY?: string;

  @IsOptional()
  @IsString()
  FIRECRAWL_API_KEY?: string;

  @IsOptional()
  @IsString()
  DATAFORSEO_LOGIN?: string;

  @IsOptional()
  @IsString()
  DATAFORSEO_PASSWORD?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  PORT?: string;
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
