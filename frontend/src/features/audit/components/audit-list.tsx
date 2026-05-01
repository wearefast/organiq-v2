'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listAudits, type AuditSummary } from '../services/audit.service';

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-[#FEF9C3]', text: 'text-[#854D0E]', label: 'Pending' },
  PROCESSING: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', label: 'Processing' },
  COMPLETE: { bg: 'bg-[#DCFCE7]', text: 'text-[#166534]', label: 'Complete' },
  FAILED: { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', label: 'Failed' },
};

export function AuditList() {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAudits()
      .then((res) => setAudits(res.audits))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-[#9CA3AF]">Loading audits...</p>
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-[#9CA3AF]">No audits yet. Start one with the "New audit" button.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E8EAF0] bg-[#F8F9FC]">
            <th className="px-4 py-3 font-medium text-[#6B7280]">Website</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">Status</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">SEO</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">GEO</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">AEO</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">Created</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {audits.map((audit) => {
            const badge = STATUS_BADGE[audit.status] ?? STATUS_BADGE.PENDING;
            const href =
              audit.status === 'PROCESSING'
                ? `/dashboard/audits/${audit.id}/pipeline`
                : `/dashboard/audits/${audit.id}`;

            return (
              <tr key={audit.id} className="border-b border-[#E8EAF0] last:border-b-0 hover:bg-[#F8F9FC]">
                <td className="px-4 py-3 font-medium text-[#111827]">
                  {audit.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#4B5563]">{audit.seoScore ?? '—'}</td>
                <td className="px-4 py-3 text-[#4B5563]">{audit.geoScore ?? '—'}</td>
                <td className="px-4 py-3 text-[#4B5563]">{audit.aeoScore ?? '—'}</td>
                <td className="px-4 py-3 text-[#6B7280]">
                  {new Date(audit.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={href}
                    className="text-xs font-medium text-[#DA304F] hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
