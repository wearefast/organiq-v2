'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { listAudits, type AuditSummary } from '../services/audit.service';
import { StatusBadge } from '@/shared/components/status-badge';
import { Search, Globe } from 'lucide-react';

export function AuditList() {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    listAudits()
      .then((res) => setAudits(res.audits))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return audits.filter((a) => {
      const matchesSearch = !searchQuery || a.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [audits, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-[#F3F4F6] px-5 py-4 last:border-b-0">
              <div className="h-8 w-8 animate-pulse rounded-lg bg-[#F3F4F6]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-[#F3F4F6]" />
                <div className="h-3 w-24 animate-pulse rounded bg-[#F3F4F6]" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-[#F3F4F6]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F9FC]">
          <Search className="h-5 w-5 text-[#9CA3AF]" />
        </div>
        <p className="text-sm font-medium text-[#111827]">No audits yet</p>
        <p className="mt-1 text-sm text-[#9CA3AF]">Run your first audit to see results here.</p>
        <Link
          href="/dashboard/audits/new"
          className="mt-5 inline-flex items-center rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1F2937]"
        >
          Start your first audit
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
      {/* Filter bar */}
      <div className="flex items-center gap-3 border-b border-[#F3F4F6] px-5 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search by domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[#E8EAF0] bg-[#F8F9FC] pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#E8EAF0] bg-[#F8F9FC] px-3 text-sm text-[#4B5563] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
        >
          <option value="ALL">All statuses</option>
          <option value="COMPLETE">Complete</option>
          <option value="PROCESSING">Processing</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Table */}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#F3F4F6] bg-[#FAFAFB]">
            <th className="table-header-cell px-5 py-3">Website</th>
            <th className="table-header-cell px-5 py-3">Status</th>
            <th className="table-header-cell px-5 py-3">SEO</th>
            <th className="table-header-cell px-5 py-3">GEO</th>
            <th className="table-header-cell px-5 py-3">AEO</th>
            <th className="table-header-cell px-5 py-3">Created</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((audit) => {
            const href =
              audit.status === 'PROCESSING'
                ? `/dashboard/audits/${audit.id}/pipeline`
                : `/dashboard/audits/${audit.id}`;

            return (
              <tr key={audit.id} className="border-b border-[#F3F4F6] transition-colors last:border-b-0 hover:bg-[#FAFAFB]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F8F9FC]">
                      <Globe className="h-3.5 w-3.5 text-[#9CA3AF]" />
                    </div>
                    <span className="font-medium text-[#111827]">
                      {audit.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={audit.status} pulse={audit.status === 'PROCESSING'} />
                </td>
                <td className="px-5 py-3.5 text-[#4B5563]">{audit.seoScore ?? '—'}</td>
                <td className="px-5 py-3.5 text-[#4B5563]">{audit.geoScore ?? '—'}</td>
                <td className="px-5 py-3.5 text-[#4B5563]">{audit.aeoScore ?? '—'}</td>
                <td className="px-5 py-3.5 text-[#9CA3AF]">
                  {new Date(audit.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    href={href}
                    className="text-xs font-medium text-[#9CA3AF] transition-colors hover:text-[#111827]"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-[#9CA3AF]">No audits match your filters.</p>
      )}
    </div>
  );
}
