import { apiFetch } from '@/shared/utils/api';

export interface Notification {
  id: string;
  organizationId: string;
  projectId: string | null;
  type: 'decay_alert' | 'workflow_complete' | 'approval_needed' | 'system';
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface DecayAlert {
  id: string;
  projectId: string;
  keyword: string;
  page: string;
  previousPosition: string;
  currentPosition: string;
  positionDelta: string;
  previousClicks: number;
  currentClicks: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  resolvedAt: string | null;
}

export async function fetchNotifications(
  organizationId: string,
  opts?: { unreadOnly?: boolean; limit?: number },
): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (opts?.unreadOnly) params.set('unreadOnly', 'true');
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<Notification[]>(
    `/organizations/${organizationId}/notifications${qs ? `?${qs}` : ''}`,
  );
}

export async function fetchUnreadCount(organizationId: string): Promise<number> {
  const result = await apiFetch<{ count: number }>(
    `/organizations/${organizationId}/notifications/unread-count`,
  );
  return result.count;
}

export async function markNotificationRead(organizationId: string, notificationId: string): Promise<void> {
  await apiFetch(`/organizations/${organizationId}/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(organizationId: string): Promise<void> {
  await apiFetch(`/organizations/${organizationId}/notifications/read-all`, {
    method: 'PATCH',
  });
}

export async function fetchDecayAlerts(
  projectId: string,
  opts?: { includeResolved?: boolean; limit?: number },
): Promise<DecayAlert[]> {
  const params = new URLSearchParams();
  if (opts?.includeResolved) params.set('includeResolved', 'true');
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return apiFetch<DecayAlert[]>(
    `/projects/${projectId}/keywords/decay/alerts${qs ? `?${qs}` : ''}`,
  );
}

export async function resolveDecayAlert(projectId: string, alertId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/keywords/decay/alerts/${alertId}/resolve`, {
    method: 'PATCH',
  });
}
