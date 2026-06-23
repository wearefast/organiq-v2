'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRight, X } from 'lucide-react';

interface PlanLimitAlertProps {
  message: string;
  organizationId?: string;
  onDismiss?: () => void;
}

export function PlanLimitAlert({ message, organizationId, onDismiss }: PlanLimitAlertProps) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-50/10 p-4 backdrop-blur-sm">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-amber-200">Plan Limit Reached</h3>
              <p className="mt-1 text-sm text-amber-100/90">{message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {organizationId && (
                  <Link
                    href={`/organizations/${organizationId}/billing`}
                    className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                  >
                    Upgrade Plan
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="flex-shrink-0 text-amber-100/60 hover:text-amber-100 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

