'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { X } from 'lucide-react';
import { apiFetch, setAuthToken } from '@/shared/utils/api';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  onClose: () => void;
  onSuccess: (workspace: Workspace) => void;
}

function slugify(value: string) {
  return (
    value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) ||
    'workspace'
  );
}


export function CreateWorkspaceModal({ onClose, onSuccess }: Props) {
  const router = useRouter();
  const { getToken, orgId } = useAuth();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!orgId) {
      setError('No organization selected.');
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
        }),
      });
      onSuccess(created);
      router.push(`/workspaces/${created.id}/projects`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div ref={panelRef} className="card w-full max-w-md p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">New Workspace</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="space-y-2 text-sm text-zinc-300">
            <span>Workspace name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Shoes"
              className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-rose-500"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
