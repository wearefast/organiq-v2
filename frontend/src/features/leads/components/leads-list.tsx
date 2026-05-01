'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listLeads, type LeadSummary } from '../services/leads.service';

const AUDIT_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-[#FEF9C3]', text: 'text-[#854D0E]', label: 'Pending' },
  PROCESSING: { bg: 'bg-[#DBEAFE]', text: 'text-[#1E40AF]', label: 'Processing' },
  COMPLETE: { bg: 'bg-[#DCFCE7]', text: 'text-[#166534]', label: 'Complete' },
  FAILED: { bg: 'bg-[#FEE2E2]', text: 'text-[#991B1B]', label: 'Failed' },
};

export function LeadsList() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLeads()
      .then((res) => setLeads(res.leads))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-[#9CA3AF]">Loading leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
        <p className="text-sm text-[#9CA3AF]">No leads yet. Leads from the public audit form will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#E8EAF0] bg-[#F8F9FC]">
            <th className="px-4 py-3 font-medium text-[#6B7280]">Name</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">Email</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">Website</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">Audit</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">SEO Score</th>
            <th className="px-4 py-3 font-medium text-[#6B7280]">Date</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const badge = lead.auditStatus
              ? AUDIT_BADGE[lead.auditStatus] ?? AUDIT_BADGE.PENDING
              : null;

            return (
              <tr key={lead.id} className="border-b border-[#E8EAF0] last:border-b-0 hover:bg-[#F8F9FC]">
                <td className="px-4 py-3 font-medium text-[#111827]">{lead.name}</td>
                <td className="px-4 py-3 text-[#4B5563]">{lead.email}</td>
                <td className="px-4 py-3 text-[#4B5563]">
                  {lead.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </td>
                <td className="px-4 py-3">
                  {badge ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#4B5563]">{lead.seoScore ?? '—'}</td>
                <td className="px-4 py-3 text-[#6B7280]">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {lead.auditId && (
                    <Link
                      href={`/dashboard/audits/${lead.auditId}`}
                      className="text-xs font-medium text-[#DA304F] hover:underline"
                    >
                      View audit
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
