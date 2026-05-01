import { apiFetch } from '@/shared/utils/api';

export interface LeadSummary {
  id: string;
  email: string;
  name: string;
  websiteUrl: string;
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
