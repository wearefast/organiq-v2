import { SetMetadata } from '@nestjs/common';

export type ResourceAccessType = 'org' | 'workspace' | 'project';

/**
 * Metadata key used by AccessGuard to determine the target resource type.
 */
export const RESOURCE_ACCESS_KEY = 'resourceAccess';

/**
 * Decorator that tells AccessGuard what resource type this route operates on.
 *
 * Usage:
 *   @ResourceAccess('workspace')  → guard uses :workspaceId or :id as the workspace
 *   @ResourceAccess('project')    → guard uses :projectId or :id as the project
 *   @ResourceAccess('org')        → guard checks any org-level grant (admin always passes)
 *
 * Must be used on routes protected by AccessGuard, which must run after OrgMembershipGuard.
 */
export const ResourceAccess = (type: ResourceAccessType) =>
  SetMetadata(RESOURCE_ACCESS_KEY, type);
