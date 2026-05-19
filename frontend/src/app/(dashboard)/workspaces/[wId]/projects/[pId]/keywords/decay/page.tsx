'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';
import { DecayAlert, fetchDecayAlerts, resolveDecayAlert } from '@/shared/services/notifications.service';

const SEVERITY_STYLES: Record<string, { badge: string; icon: string }> = {
  critical: { badge: 'bg-red-500/10 text-red-400 border-red-500/30', icon: 'text-red-500' },
  high: { badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30', icon: 'text-orange-500' },
  medium: { badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: 'text-yellow-500' },
  low: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: 'text-blue-500' },
};

export default function DecayAlertsPage() {
  const params = useParams<{ pId: string }>();
  const projectId = params.pId;

  const [alerts, setAlerts] = useState<DecayAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDecayAlerts(projectId, { includeResolved: showResolved });
      setAlerts(data);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [projectId, showResolved]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleResolve = async (alertId: string) => {
    await resolveDecayAlert(projectId, alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolvedAt: new Date().toISOString() } : a)),
    );
  };

  const unresolvedCount = alerts.filter((a) => !a.resolvedAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Decay Alerts</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Keywords losing ranking positions over the past 2 weeks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {unresolvedCount} active alert{unresolvedCount !== 1 ? 's' : ''}
          </span>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-800"
            />
            Show resolved
          </label>
        </div>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-zinc-500">Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 py-12 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-green-500/50" />
          <p className="mt-3 text-sm text-zinc-400">No decay alerts — rankings are stable</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <DecayAlertCard
              key={alert.id}
              alert={alert}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DecayAlertCard({
  alert,
  onResolve,
}: {
  alert: DecayAlert;
  onResolve: (id: string) => void;
}) {
  const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.low;
  const isResolved = !!alert.resolvedAt;

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
        isResolved
          ? 'border-zinc-800 bg-zinc-900/30 opacity-60'
          : 'border-zinc-700 bg-zinc-900'
      }`}
    >
      {/* Icon */}
      <TrendingDown className={`h-5 w-5 flex-shrink-0 ${style.icon}`} />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-zinc-100">{alert.keyword}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.badge}`}>
            {alert.severity}
          </span>
        </div>
        {alert.page && (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{alert.page}</p>
        )}
      </div>

      {/* Position change */}
      <div className="flex-shrink-0 text-right">
        <div className="text-sm text-zinc-300">
          <span className="text-zinc-500">{parseFloat(alert.previousPosition).toFixed(1)}</span>
          <span className="mx-1 text-zinc-600">→</span>
          <span className="text-red-400">{parseFloat(alert.currentPosition).toFixed(1)}</span>
        </div>
        <p className="text-[10px] text-zinc-500">
          ↓ {parseFloat(alert.positionDelta).toFixed(1)} positions
        </p>
      </div>

      {/* Clicks change */}
      <div className="flex-shrink-0 text-right">
        <div className="text-xs text-zinc-400">
          {alert.previousClicks} → {alert.currentClicks} clicks
        </div>
      </div>

      {/* Actions */}
      {!isResolved && (
        <button
          onClick={() => onResolve(alert.id)}
          className="flex-shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Resolve
        </button>
      )}
    </div>
  );
}
