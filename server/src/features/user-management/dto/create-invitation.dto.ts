import {
  IsEmail,
  IsEnum,
  IsArray,
  ValidateNested,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrgGrantDto {
  type!: 'org';
}

class WorkspaceGrantDto {
  type!: 'workspace';
  @IsString() workspaceId!: string;
}

class ProjectGrantDto {
  type!: 'project';
  @IsString() workspaceId!: string;
  @IsString() projectId!: string;
}

export type AccessGrantSpec =
  | { type: 'org' }
  | { type: 'workspace'; workspaceId: string }
  | { type: 'project'; workspaceId: string; projectId: string };

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(['admin', 'user'])
  role!: 'admin' | 'user';

  /**
   * Granular access grants to apply when the invitation is accepted.
   * Examples:
   *   [{ type: 'org' }]                                  → full org access
   *   [{ type: 'workspace', workspaceId: '...' }]        → one workspace
   *   [{ type: 'project', workspaceId: '...', projectId: '...' }]
   */
  @IsArray()
  @IsOptional()
  accessGrants?: AccessGrantSpec[];
}
