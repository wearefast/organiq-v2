import { IsString, IsOptional, MaxLength, IsUUID } from 'class-validator';

export class CreateWorkspaceDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;
}
