import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateKeywordWorkflowDto {
  @ApiPropertyOptional({ example: 'en', enum: ['en'], default: 'en' })
  @IsOptional()
  @IsIn(['en'])
  language?: 'en';

  @ApiProperty({ example: 'ae' })
  @IsString()
  country: string;
}