import { apiFetch } from '@/shared/utils/api';

export interface BusinessProfile {
  domain?: string;
  companyName?: string;
  businessName?: string;
  business_name?: string;
  industry?: string;
  description?: string;
  targetAudience?: string | string[];
  goals?: string[];
  competitors?: Array<string | { name: string; link?: string }>;
  primaryMarket?: string;
  primary_services?: string[];
  brand_voice?: string;
  positioning?: string;
  content_gaps?: string[];
  trust_signals?: string[];
  analyst_notes?: string;
  [key: string]: unknown;
}

export interface BusinessProfileResponse {
  profile: BusinessProfile | null;
  updatedAt: string | null;
}

export interface RefreshSuggestion {
  id: string;
  projectId: string;
  dataType: string;
  targetKey: string | null;
  reason: string;
  suggestedBy: string;
  suggestedAt: string;
  lastUpdated: string;
  dismissed: boolean;
}

export async function getBusinessProfile(projectId: string): Promise<BusinessProfileResponse> {
  return apiFetch<BusinessProfileResponse>(`/projects/${projectId}/business-profile`);
}

export async function refreshBusinessProfile(projectId: string): Promise<BusinessProfileResponse> {
  return apiFetch<BusinessProfileResponse>(`/projects/${projectId}/business-profile/refresh`, {
    method: 'POST',
  });
}

export async function updateBusinessProfile(
  projectId: string,
  profile: BusinessProfile,
): Promise<BusinessProfileResponse> {
  return apiFetch<BusinessProfileResponse>(`/projects/${projectId}/business-profile`, {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
}

export async function getRefreshSuggestions(projectId: string): Promise<RefreshSuggestion[]> {
  return apiFetch<RefreshSuggestion[]>(`/projects/${projectId}/intelligence/refresh-suggestions`);
}

export async function dismissRefreshSuggestion(projectId: string, suggestionId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/intelligence/refresh-suggestions/${suggestionId}/dismiss`, {
    method: 'POST',
  });
}
