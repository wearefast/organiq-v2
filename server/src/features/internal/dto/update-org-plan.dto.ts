import { IsString, IsIn } from 'class-validator';

export class UpdateOrgPlanDto {
  @IsString()
  @IsIn(['starter', 'pro', 'agency', 'enterprise'])
  plan!: 'starter' | 'pro' | 'agency' | 'enterprise';
}
