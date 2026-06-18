import { IsEnum, IsOptional, IsString, IsArray, IsUUID } from 'class-validator';
import { AccessGrantSpec } from './create-invitation.dto';

export class UpdateMemberAccessDto {
  /**
   * Full replacement set of access grants for this member.
   * Existing grants not in this list will be removed.
   * Pass [{ type: 'org' }] for full org access.
   * Pass [] to remove all non-admin access (effectively lock out the user).
   */
  @IsArray()
  accessGrants!: AccessGrantSpec[];
}

export class SetCreditLimitDto {
  /**
   * Monthly credit spending cap for this workspace (in credits).
   * Set to 0 to block all credit usage in this workspace.
   */
  @IsOptional()
  monthlyLimit?: number;
}
