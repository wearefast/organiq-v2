import { IsString, IsOptional, MaxLength, IsUUID, IsUrl, IsArray, ArrayMaxSize } from 'class-validator';

export class CreateProjectDto {
  @IsUUID()
  workspaceId: string;

  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(255)
  domain: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(10)
  directCompetitors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: true, require_protocol: true }, { message: 'customSitemapUrl must be a valid URL' })
  customSitemapUrl?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(10)
  directCompetitors?: string[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_tld: true, require_protocol: true }, { message: 'customSitemapUrl must be a valid URL' })
  customSitemapUrl?: string | null;
}
