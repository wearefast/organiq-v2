'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/shared/hooks/use-notifications';
import type { Notification } from '@/shared/services/notifications.service';

interface NotificationBellProps {
  organizationId: string | undefined;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ organizationId }: NotificationBellProps) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(organizationId);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative mr-3 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <span className="text-sm font-medium text-zinc-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-500">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const isUnread = !notification.readAt;
  const severity = (notification.metadata as Record<string, unknown>)?.severity as string | undefined;

  return (
    <button
      onClick={() => isUnread && onRead(notification.id)}
      className={`flex w-full gap-3 border-b border-zinc-800 px-4 py-3 text-left transition-colors last:border-0 hover:bg-zinc-800/50 ${
        isUnread ? 'bg-zinc-800/30' : ''
      }`}
    >
      {/* Severity dot */}
      <div className="mt-1 flex-shrink-0">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            severity ? SEVERITY_COLORS[severity] ?? 'bg-zinc-500' : 'bg-zinc-500'
          }`}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs ${isUnread ? 'font-medium text-zinc-100' : 'text-zinc-300'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{notification.message}</p>
        <p className="mt-1 text-[10px] text-zinc-600">{timeAgo(notification.createdAt)}</p>
      </div>
    </button>
  );
}
