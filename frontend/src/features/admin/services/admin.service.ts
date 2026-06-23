import { apiFetch } from '@/shared/utils/api';

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'agency' | 'enterprise';
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

export async function updateOrgPlan(orgId: string, plan: 'starter' | 'pro' | 'agency' | 'enterprise'): Promise<AdminOrg> {
  return apiFetch<AdminOrg>(`/internal/orgs/${orgId}/plan`, {
    method: 'PUT',
    body: JSON.stringify({ plan }),
  });
}

// ─── API Usage ────────────────────────────────────────────────

export interface ProviderTotals {
  provider: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface DailyTotal {
  date: string;
  provider: string;
  calls: number;
  costUsd: number;
}

export interface ApiUsageSummary {
  totalCostUsd: number;
  totalCalls: number;
  byProvider: ProviderTotals[];
  byDay: DailyTotal[];
}

export interface ProjectCost {
  projectId: string;
  projectName: string;
  workspaceName: string;
  runs: number;
  calls: number;
  costUsd: number;
}

export interface RunStepCost {
  stepKey: string;
  provider: string;
  endpoint: string;
  tokensIn: number | null;
  tokensOut: number | null;
  calls: number;
  costUsd: number;
  durationMs: number | null;
  createdAt: string;
}

export async function getApiUsageSummary(params: {
  orgId?: string;
  from?: string;
  to?: string;
}): Promise<ApiUsageSummary> {
  const qs = new URLSearchParams();
  if (params.orgId) qs.set('orgId', params.orgId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return apiFetch<ApiUsageSummary>(`/internal/api-usage/summary?${qs}`);
}

export async function getApiUsageByProject(params: {
  orgId?: string;
  from?: string;
  to?: string;
}): Promise<ProjectCost[]> {
  const qs = new URLSearchParams();
  if (params.orgId) qs.set('orgId', params.orgId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return apiFetch<ProjectCost[]>(`/internal/api-usage/by-project?${qs}`);
}

export async function getApiUsageByRun(runId: string): Promise<RunStepCost[]> {
  return apiFetch<RunStepCost[]>(`/internal/api-usage/by-run/${runId}`);
}

export async function downloadApiUsageCsv(params: {
  orgId?: string;
  from?: string;
  to?: string;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params.orgId) qs.set('orgId', params.orgId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  // Use window.open to trigger browser download (avoids CORS complexity with blob URLs)
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
  window.open(`${apiBase}/internal/api-usage/export?${qs}`, '_blank');
}

