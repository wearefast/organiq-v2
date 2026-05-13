'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, useClerk, useOrganizationList } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '@/shared/utils/api';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  projects?: Array<{ id: string }>;
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'workspace';
}

function normalizeDomain(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;
  return trimmedValue.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').slice(0, 255);
}

export default function WorkspacesPage() {
  const router = useRouter();
  const clerk = useClerk();
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();
  const { isLoaded: organizationsLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePrimaryAction() {
    setError(null);
    if (orgId) {
      setShowForm((open) => !open);
      return;
    }

    const firstMembership = userMemberships.data?.[0];
    if (firstMembership && setActive) {
      await setActive({ organization: firstMembership.organization.id });
      return;
    }

    if (organizationsLoaded && clerk.loaded) {
      clerk.openCreateOrganization({ afterCreateOrganizationUrl: '/workspaces' });
      return;
    }

    setError('Organization tools are still loading. Try again in a moment.');
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !orgId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadWorkspaces() {
      setLoading(true);
      setError(null);
      try {
        setAuthToken(await getToken());
        const data = await apiFetch<Workspace[]>(`/workspaces/org/${orgId}`);
        if (active) setWorkspaces(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWorkspaces();
    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn, orgId]);

  async function handleCreateWorkspace(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) {
      setError('Select an organization before creating a workspace.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Workspace name is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      setAuthToken(await getToken());
      const created = await apiFetch<Workspace>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: orgId,
          name: trimmedName,
          slug: slugify(trimmedName),
          domain: normalizeDomain(domain),
        }),
      });
      setWorkspaces((current) => [created, ...current]);
      setName('');
      setDomain('');
      setShowForm(false);
      router.push(`/workspaces/${created.id}/projects`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-zinc-100">Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-500">Manage your client workspaces and their projects.</p>
        </div>
        <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { void handlePrimaryAction(); }} disabled={submitting}>
          {orgId ? (showForm ? 'Cancel' : 'New Workspace') : 'Set Up Organization'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateWorkspace} className="card space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Workspace name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Shoes" className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-rose-500" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Primary domain</span>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acmeshoes.com" className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-rose-500" />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">Slug preview: {slugify(name || 'workspace')}</p>
            <button type="submit" className="btn-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="card py-16 text-center text-sm text-zinc-500">Loading workspaces...</div>
      ) : workspaces.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {workspaces.map((workspace) => (
            <Link key={workspace.id} href={`/workspaces/${workspace.id}/projects`} className="card block space-y-2 p-5 transition-colors hover:border-zinc-600 hover:bg-zinc-900/60">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-zinc-100">{workspace.name}</h2>
                <span className="text-xs text-zinc-500">{workspace.projects?.length ?? 0} projects</span>
              </div>
              <p className="text-sm text-zinc-400">{workspace.domain || 'No domain set yet'}</p>
              <p className="text-xs uppercase tracking-wide text-zinc-600">/{workspace.slug}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 012.25 10.875v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-300">No workspaces yet</h3>
          <p className="mt-1 text-sm text-zinc-500">{orgId ? 'Create your first workspace to start managing SEO projects.' : 'Create or join an organization to start managing client workspaces.'}</p>
        </div>
      )}
    </div>
  );
}
