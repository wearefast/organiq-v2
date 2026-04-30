import { IsString, IsUrl, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateKeywordProjectDto {
  @ApiProperty({ example: 'My SEO Campaign' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://example.com' })
  @IsUrl()
  websiteUrl: string;

  @ApiProperty({ example: ['seo agency', 'digital marketing'] })
  @IsArray()
  @IsString({ each: true })
  seedKeywords: string[];
}
