import { apiFetch } from '@/shared/utils/api';

export interface WorkspaceBasic {
  id: string;
  name: string;
  slug: string;
}

export interface ProjectBasic {
  id: string;
  name: string;
}

export interface CreditLimitResult {
  workspaceId: string;
  hasLimit: boolean;
  monthlyLimit?: number;
  currentMonthUsage?: number;
  remainingCredits?: number;
  periodStart?: string;
  periodExpired?: boolean;
}

export interface AccessGrant {
  id: string;
  grantType: 'org' | 'workspace' | 'project';
  workspaceId: string | null;
  projectId: string | null;
  workspaceName?: string | null;
  projectName?: string | null;
}

export interface OrgMember {
  id: string;
  organizationId: string;
  clerkUserId: string;
  role: 'admin' | 'user' | 'owner' | 'member';
  email: string;
  name: string | null;
  createdAt: string;
  grants: AccessGrant[];
}

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  accessGrants: Array<{
    type: 'org' | 'workspace' | 'project';
    workspaceId?: string;
    projectId?: string;
    workspaceName?: string | null;
    projectName?: string | null;
  }>;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface InvitePayload {
  email: string;
  role: 'admin' | 'user';
  accessGrants?: Array<{
    type: 'org' | 'workspace' | 'project';
    workspaceId?: string;
    projectId?: string;
  }>;
}

export async function listMembers(orgId: string): Promise<OrgMember[]> {
  return apiFetch<OrgMember[]>(`/orgs/${orgId}/members`);
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  await apiFetch(`/orgs/${orgId}/members/${memberId}`, { method: 'DELETE' });
}

export async function updateMemberAccess(
  orgId: string,
  memberId: string,
  accessGrants: InvitePayload['accessGrants'],
): Promise<void> {
  await apiFetch(`/orgs/${orgId}/members/${memberId}/access`, {
    method: 'PUT',
    body: JSON.stringify({ accessGrants }),
  });
}

export async function listInvitations(orgId: string): Promise<Invitation[]> {
  return apiFetch<Invitation[]>(`/orgs/${orgId}/invitations`);
}

export async function createInvitation(orgId: string, data: InvitePayload): Promise<Invitation> {
  return apiFetch<Invitation>(`/orgs/${orgId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<void> {
  await apiFetch(`/orgs/${orgId}/invitations/${invitationId}`, { method: 'DELETE' });
}

export async function getMyAccess(orgId: string): Promise<AccessGrant[]> {
  return apiFetch<AccessGrant[]>(`/orgs/${orgId}/members/me/access`);
}

export async function getWorkspacesForOrg(orgId: string): Promise<WorkspaceBasic[]> {
  return apiFetch<WorkspaceBasic[]>(`/workspaces/org/${orgId}`);
}

export async function getProjectsForWorkspace(workspaceId: string): Promise<ProjectBasic[]> {
  return apiFetch<ProjectBasic[]>(`/projects/workspace/${workspaceId}`);
}

export async function getWorkspaceCreditLimit(orgId: string, workspaceId: string): Promise<CreditLimitResult> {
  return apiFetch<CreditLimitResult>(`/orgs/${orgId}/workspaces/${workspaceId}/credit-limit`);
}

export async function setWorkspaceCreditLimit(
  orgId: string,
  workspaceId: string,
  monthlyLimit: number,
): Promise<CreditLimitResult> {
  return apiFetch<CreditLimitResult>(`/orgs/${orgId}/workspaces/${workspaceId}/credit-limit`, {
    method: 'PUT',
    body: JSON.stringify({ monthlyLimit }),
  });
}

export async function removeWorkspaceCreditLimit(orgId: string, workspaceId: string): Promise<void> {
  await apiFetch(`/orgs/${orgId}/workspaces/${workspaceId}/credit-limit`, { method: 'DELETE' });
}
