'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ShieldAlert, Search, Plus, Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { setAuthToken } from '@/shared/utils/api';
import {
  listOrgs,
  getOrgCredits,
  addOrgCredits,
  type AdminOrg,
  type OrgCredits,
} from '@/features/admin/services/admin.service';
import { ApiCostsPanel } from '@/features/admin/components/api-costs-panel';

// ─── Credits Panel ────────────────────────────────────────────

function CreditsPanel({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [credits, setCredits] = useState<OrgCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add credits form
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [creditType, setCreditType] = useState<'bonus' | 'purchase' | 'refund'>('bonus');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrgCredits(orgId);
      setCredits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(amount, 10);
    if (isNaN(val) || val < 1) { setAddError('Amount must be ≥ 1'); return; }
    setAdding(true);
    setAddError(null);
    setAddSuccess(false);
    try {
      const data = await addOrgCredits(orgId, {
        amount: val,
        description: description.trim() || undefined,
        type: creditType,
      });
      setCredits(data);
      setAmount('');
      setDescription('');
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 3000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add credits');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">Current balance for <span className="font-medium text-white">{orgName}</span>:</span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
        ) : error ? (
          <span className="text-sm text-red-400">{error}</span>
        ) : (
          <span className="text-xl font-bold text-white">{credits?.balance.toLocaleString() ?? '—'}</span>
        )}
        <button onClick={load} className="rounded p-1 text-zinc-500 hover:text-zinc-300" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Add credits form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Add Credits</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Amount</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Type</label>
            <select
              value={creditType}
              onChange={(e) => setCreditType(e.target.value as typeof creditType)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
            >
              <option value="bonus">Bonus</option>
              <option value="purchase">Purchase</option>
              <option value="refund">Refund</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Promotional credits"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        {addError && <p className="text-xs text-red-400">{addError}</p>}
        {addSuccess && <p className="text-xs text-green-400">Credits added successfully</p>}
        <button
          type="submit"
          disabled={adding}
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {adding ? 'Adding…' : 'Add Credits'}
        </button>
      </form>

      {/* Ledger */}
      {!loading && !error && credits && credits.ledger.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent Transactions</p>
          <div className="overflow-hidden rounded-lg border border-zinc-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-zinc-500">Description</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                {credits.ledger.slice(0, 20).map((entry) => (
                  <tr key={entry.id} className="border-b border-zinc-800 last:border-0">
                    <td className="px-3 py-2 text-zinc-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{entry.description ?? '—'}</td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${entry.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {entry.amount >= 0 ? '+' : ''}{entry.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Org Row ──────────────────────────────────────────────────

function OrgRow({ org }: { org: AdminOrg }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-700">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-zinc-800/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-500" />
        )}
        <div className="flex-1">
          <p className="font-semibold text-white">{org.name}</p>
          <p className="text-xs text-zinc-500">{org.slug}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-zinc-200">{org.creditsBalance.toLocaleString()} credits</p>
          <p className="text-xs text-zinc-600">
            Joined {new Date(org.createdAt).toLocaleDateString()}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <CreditsPanel orgId={org.id} orgName={org.name} />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminPage() {
  const { getToken } = useAuth();

  // CVE-005: Admin check is now enforced server-side in middleware.ts using
  // SUPER_ADMIN_CLERK_IDS (not NEXT_PUBLIC_*). If we reach this page, the
  // middleware has already verified the user is an admin. No client-side
  // NEXT_PUBLIC_SUPER_ADMIN_CLERK_IDS check needed here.

  const [activeTab, setActiveTab] = useState<'orgs' | 'api-costs'>('orgs');
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setAuthToken(await getToken());
        const data = await listOrgs(500);
        if (active) setOrgs(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load orgs');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [getToken]);

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading && orgs.length === 0) return (
    <div className="flex items-center gap-2 p-6 text-sm text-zinc-500">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Admin</h1>
          <p className="text-sm text-zinc-500">Manage organizations, credits, and API costs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-700">
        {([
          { key: 'orgs',      label: 'Organizations' },
          { key: 'api-costs', label: 'API Costs' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-violet-400 text-violet-300'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Organizations Tab ── */}
      {activeTab === 'orgs' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Org list */}
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading organizations…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-sm text-zinc-500">
              {search ? 'No organizations match your search.' : 'No organizations found.'}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">{filtered.length} organization{filtered.length !== 1 ? 's' : ''}</p>
              {filtered.map((org) => (
                <OrgRow key={org.id} org={org} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── API Costs Tab ── */}
      {activeTab === 'api-costs' && (
        <ApiCostsPanel orgs={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      )}
    </div>
  );
}

