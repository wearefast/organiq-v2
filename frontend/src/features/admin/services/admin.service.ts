import { apiFetch } from '@/shared/utils/api';

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  creditsBalance: number;
  clerkOrgId: string;
  createdAt: string;
}

export interface OrgCredits {
  balance: number;
  ledger: Array<{
    id: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }>;
}

export interface AddCreditsPayload {
  amount: number;
  description?: string;
  type?: 'purchase' | 'bonus' | 'refund';
}

export async function listOrgs(limit = 200): Promise<AdminOrg[]> {
  return apiFetch<AdminOrg[]>(`/internal/orgs?limit=${limit}`);
}

export async function getOrgCredits(orgId: string): Promise<OrgCredits> {
  return apiFetch<OrgCredits>(`/internal/orgs/${orgId}/credits`);
}

export async function addOrgCredits(orgId: string, payload: AddCreditsPayload): Promise<OrgCredits> {
  return apiFetch<OrgCredits>(`/internal/orgs/${orgId}/credits`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
