import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class AddCreditsDto {
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  /** 'purchase' | 'bonus' | 'refund' */
  @IsString()
  @IsOptional()
  type?: 'purchase' | 'bonus' | 'refund';
}
