'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listAudits, type AuditSummary } from '@/features/audit/services/audit.service';
import { listLeads, type LeadSummary } from '@/features/leads/services/leads.service';
import { StatusBadge, Avatar } from '@/shared/components';
import { BarChart3, Search, Key, FileText, Users } from 'lucide-react';

export default function DashboardPage() {
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [leads, setLeads] = useState<LeadSummary[]>([]);

  useEffect(() => {
    Promise.all([listAudits(), listLeads()]).then(([auditRes, leadRes]) => {
      setAudits(auditRes.audits);
      setLeads(leadRes.leads);
    });
  }, []);

  const completed = audits.filter((a) => a.status === 'COMPLETE');
  const scores = completed.map((a) => a.seoScore).filter((s): s is number => s !== null);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-bold text-[#111827]">Welcome back</h1>
        <p className="mt-1 text-sm text-[#9CA3AF]">Here&apos;s what&apos;s happening across your workspace.</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard href="/dashboard/audits" icon={Search} label="Total audits" value={audits.length} sub={`${completed.length} complete`} />
        <StatCard href="/dashboard/keywords" icon={Key} label="Active keywords" value="—" sub="across projects" />
        <StatCard href="/dashboard/content" icon={FileText} label="Content pieces" value="—" sub="in pipeline" />
        <StatCard href="/dashboard/leads" icon={Users} label="Leads captured" value={leads.length} sub={`${leads.filter((l) => l.status === 'CONVERTED').length} converted`} />
      </div>

      {/* Activity grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent audits */}
        <div className="rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="text-[15px] font-semibold text-[#111827]">Recent audits</h3>
            <Link href="/dashboard/audits" className="text-xs font-medium text-[#9CA3AF] hover:text-[#4B5563]">View all</Link>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {audits.slice(0, 3).map((audit) => (
              <Link key={audit.id} href={`/dashboard/audits/${audit.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#FAFAFB]">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8F9FC]">
                  <Search className="h-3.5 w-3.5 text-[#9CA3AF]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#111827]">{new URL(audit.websiteUrl).hostname}</p>
                  <p className="text-xs text-[#9CA3AF]">{audit.websiteUrl}</p>
                </div>
                {audit.seoScore !== null && (
                  <span className="text-sm font-bold text-[#111827]">{audit.seoScore}</span>
                )}
                <StatusBadge status={audit.status} pulse={audit.status === 'PROCESSING'} />
              </Link>
            ))}
            {audits.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-[#9CA3AF]">No audits yet</p>
            )}
          </div>
        </div>

        {/* New leads */}
        <div className="rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="text-[15px] font-semibold text-[#111827]">New leads</h3>
            <Link href="/dashboard/leads" className="text-xs font-medium text-[#9CA3AF] hover:text-[#4B5563]">View all</Link>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {leads.slice(0, 3).map((lead) => (
              <div key={lead.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={lead.name || lead.email} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#111827]">{lead.name || lead.email}</p>
                  <p className="text-xs text-[#9CA3AF]">{lead.websiteUrl ? new URL(lead.websiteUrl).hostname : lead.email}</p>
                </div>
                <StatusBadge status={lead.status} />
              </div>
            ))}
            {leads.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-[#9CA3AF]">No leads yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ href, icon: Icon, label, value, sub }: { href: string; icon: React.ElementType; label: string; value: string | number; sub: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-[#E8EAF0] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">{label}</p>
        <Icon className="h-4 w-4 text-[#D0D5DD] transition-colors group-hover:text-[#9CA3AF]" />
      </div>
      <p className="mt-2 text-[28px] font-bold leading-none text-[#111827]">{value}</p>
      <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p>
    </Link>
  );
}
