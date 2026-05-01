import { IsString, IsUrl, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAuditDto {
  @ApiProperty({ example: 'https://example.com' })
  @IsUrl()
  websiteUrl: string;

  @ApiProperty({ example: 'Digital marketing agency focused on B2B SaaS' })
  @IsString()
  businessDescription: string;

  @ApiProperty({ example: ['us', 'gb'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries: string[] = [];
}
