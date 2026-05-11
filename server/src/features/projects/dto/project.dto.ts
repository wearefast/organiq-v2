import { IsString, IsOptional, MaxLength, IsUUID, IsUrl } from 'class-validator';

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
}
