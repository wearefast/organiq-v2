'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Notification,
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/shared/services/notifications.service';

export function useNotifications(organizationId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        fetchNotifications(organizationId, { limit: 30 }),
        fetchUnreadCount(organizationId),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    refresh();
    // Poll every 60s for new notifications
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!organizationId) return;
      await markNotificationRead(organizationId, notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [organizationId],
  );

  const markAllRead = useCallback(async () => {
    if (!organizationId) return;
    await markAllNotificationsRead(organizationId);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }, [organizationId]);

  return { notifications, unreadCount, loading, refresh, markRead, markAllRead };
}
