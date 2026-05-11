import { apiFetch } from '@/shared/utils/api';

export interface LeadSummary {
  id: string;
  email: string;
  name: string;
  websiteUrl: string;
  businessDetails?: {
    description?: string;
    internalNotes?: string;
    [key: string]: unknown;
  };
  auditId: string | null;
  score: number | null;
  status: string;
  createdAt: string;
  auditStatus: string | null;
  seoScore: number | null;
}

interface ListLeadsResponse {
  leads: LeadSummary[];
  page: number;
  limit: number;
}

export async function listLeads(page = 1, limit = 50): Promise<ListLeadsResponse> {
  return apiFetch<ListLeadsResponse>(`/leads?page=${page}&limit=${limit}`);
}

export async function updateLead(id: string, body: { status: string; notes: string }): Promise<LeadSummary> {
  return apiFetch<LeadSummary>(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
