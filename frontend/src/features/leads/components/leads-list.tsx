'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listLeads, type LeadSummary } from '../services/leads.service';
import { StatusBadge } from '@/shared/components/status-badge';
import { Avatar } from '@/shared/components/avatar';
import { Button } from '@/shared/components/button';
import { ExternalLink, Users, X } from 'lucide-react';

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

function leadDescription(lead: LeadSummary) {
  const domain = lead.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `${lead.name || 'This lead'} requested an audit for ${domain} and entered the strategist funnel through the public visibility audit flow.`;
}

function LeadDrawer({
  lead,
  status,
  notes,
  onClose,
  onStatusChange,
  onNotesChange,
  onSave,
}: {
  lead: LeadSummary;
  status: string;
  notes: string;
  onClose: () => void;
  onStatusChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[#071932]/30 backdrop-blur-sm">
      <button type="button" className="flex-1 cursor-default" aria-label="Close lead drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--canvas)] shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar name={lead.name || lead.email} size="lg" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Lead profile</p>
              <h2 className="mt-1 text-[24px] font-bold text-[var(--text-primary)]">{lead.name || lead.email}</h2>
              <p className="text-sm text-[var(--text-body)]">{lead.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-pill border border-[var(--border)] bg-[var(--canvas)] p-2 text-[var(--text-body)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
            aria-label="Close lead drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Business context</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-body)]">{leadDescription(lead)}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Linked audit</p>
                <p className="mt-2 text-[24px] font-bold text-[var(--text-primary)]">{lead.seoScore ?? '—'}</p>
                <p className="text-sm text-[var(--text-body)]">SEO score</p>
              </div>
              <div className="text-right">
                {lead.auditStatus ? <StatusBadge status={lead.auditStatus} /> : <span className="status-neutral">No audit</span>}
                {lead.auditId ? (
                  <Link
                    href={`/dashboard/audits/${lead.auditId}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--cc-red)] transition-colors hover:opacity-80"
                  >
                    Open audit
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]" htmlFor="lead-status">
              Lead status
            </label>
            <select
              id="lead-status"
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              className="mt-3 input-base"
            >
              {LEAD_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]" htmlFor="lead-notes">
              Notes
            </label>
            <textarea
              id="lead-notes"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              rows={6}
              placeholder="Capture outreach context, qualification notes, or follow-up decisions."
              className="mt-3 w-full rounded-[10px] border border-[var(--input-border)] bg-[var(--canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
          </div>
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4">
          <Button type="button" className="w-full" onClick={onSave}>
            Save changes
          </Button>
        </div>
      </aside>
    </div>
  );
}

export function LeadsList() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<LeadSummary | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>('new');
  const [draftNotes, setDraftNotes] = useState<string>('');

  useEffect(() => {
    listLeads()
      .then((res) => setLeads(res.leads))
      .finally(() => setLoading(false));
  }, []);

  function openLead(lead: LeadSummary) {
    setSelectedLead(lead);
    setDraftStatus(lead.status.toLowerCase());
    setDraftNotes('');
  }

  function saveLead() {
    if (!selectedLead) return;

    setLeads((current) =>
      current.map((lead) =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              status: draftStatus.toUpperCase(),
            }
          : lead,
      ),
    );

    setSelectedLead((current) =>
      current
        ? {
            ...current,
            status: draftStatus.toUpperCase(),
          }
        : null,
    );
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
        <div className="space-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-[#F3F4F6] px-5 py-4 last:border-b-0">
              <div className="h-8 w-8 animate-pulse rounded-full bg-[#F3F4F6]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-[#F3F4F6]" />
                <div className="h-3 w-48 animate-pulse rounded bg-[#F3F4F6]" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-[#F3F4F6]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F9FC]">
          <Users className="h-5 w-5 text-[#9CA3AF]" />
        </div>
        <p className="text-sm font-medium text-[#111827]">No leads yet</p>
        <p className="mt-1 text-sm text-[#9CA3AF]">Leads from the public audit form will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#F3F4F6] bg-[#FAFAFB]">
            <th className="table-header-cell px-5 py-3">Name</th>
            <th className="table-header-cell px-5 py-3">Email</th>
            <th className="table-header-cell px-5 py-3">Website</th>
            <th className="table-header-cell px-5 py-3">Score</th>
            <th className="table-header-cell px-5 py-3">Status</th>
            <th className="table-header-cell px-5 py-3">Date</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="cursor-pointer border-b border-[#F3F4F6] transition-colors last:border-b-0 hover:bg-[#FAFAFB] focus-within:bg-[#FAFAFB]"
              onClick={() => openLead(lead)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openLead(lead);
                }
              }}
              tabIndex={0}
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={lead.name || lead.email} size="sm" />
                  <span className="font-medium text-[#111827]">{lead.name || '—'}</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-[#4B5563]">{lead.email}</td>
              <td className="px-5 py-3.5 text-[#4B5563]">
                {lead.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </td>
              <td className="px-5 py-3.5 font-medium text-[#111827]">{lead.seoScore ?? '—'}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-5 py-3.5 text-[#9CA3AF]">
                {new Date(lead.createdAt).toLocaleDateString()}
              </td>
              <td className="px-5 py-3.5 text-right">
                {lead.auditId && (
                  <Link
                    href={`/dashboard/audits/${lead.auditId}`}
                    className="text-xs font-medium text-[#9CA3AF] transition-colors hover:text-[#111827]"
                  >
                    View audit →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedLead ? (
        <LeadDrawer
          lead={selectedLead}
          status={draftStatus}
          notes={draftNotes}
          onClose={() => setSelectedLead(null)}
          onStatusChange={setDraftStatus}
          onNotesChange={setDraftNotes}
          onSave={saveLead}
        />
      ) : null}
    </div>
  );
}
