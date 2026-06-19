'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '@/shared/utils/api';
import { CountrySelect } from '@/shared/components/country-select';
import { LanguageSelect } from '@/shared/components/language-select';
import { getCountryByCode, getLanguageByCode } from '@/shared/utils/countries';

interface Project {
  id: string;
  name: string;
  domain: string;
  country: string;
  language: string;
  industry?: string | null;
}

interface Workspace {
  id: string;
  name: string;
  organizationId: string;
  projects: Project[];
}

function normalizeDomain(value: string) {
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').slice(0, 255);
}

export default function ProjectsPage() {
  const params = useParams<{ wId: string }>();
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [country, setCountry] = useState('US');
  const [language, setLanguage] = useState('en');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !orgId || !params.wId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setError(null);
      try {
        setAuthToken(await getToken());
        const workspaces = await apiFetch<Workspace[]>(`/workspaces/org/${orgId}`);
        const currentWorkspace = workspaces.find((entry) => entry.id === params.wId) ?? null;

        if (!currentWorkspace) {
          throw new Error('Workspace not found');
        }

        if (active) {
          setWorkspace(currentWorkspace);
          setProjects(currentWorkspace.projects ?? []);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, [getToken, isLoaded, isSignedIn, orgId, params.wId]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) {
      setError('Workspace context is not available yet.');
      return;
    }

    const trimmedName = name.trim();
    const normalizedDomain = normalizeDomain(domain);

    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }

    if (!normalizedDomain) {
      setError('Project domain is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      setAuthToken(await getToken());
      const created = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: workspace.id,
          organizationId: workspace.organizationId,
          name: trimmedName,
          domain: normalizedDomain,
          country: country.trim() || 'US',
          language: language.trim() || 'en',
          industry: industry.trim() || undefined,
        }),
      });

      setProjects((current) => [created, ...current]);
      setName('');
      setDomain('');
      setCountry('US');
      setLanguage('en');
      setIndustry('');
      setShowForm(false);
      router.push(`/workspaces/${workspace.id}/projects/${created.id}/overview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
        <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-zinc-100">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {workspace ? `SEO projects within ${workspace.name}.` : 'SEO projects within this workspace.'}
          </p>
        </div>
        <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setShowForm((open) => !open)} disabled={loading || submitting || !workspace}>
            {showForm ? 'Cancel' : 'New Project'}
          </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreateProject} className="card mb-6 space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Project name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="US SEO Campaign" className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-rose-500" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Domain</span>
              <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="acme.com" className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-rose-500" />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Country</span>
              <CountrySelect value={country} onChange={setCountry} />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Language</span>
              <LanguageSelect value={language} onChange={setLanguage} />
            </label>
            <label className="col-span-full space-y-2 text-sm text-zinc-300">
              <span>Industry</span>
              <input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Footwear" className="h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none transition-colors focus:border-rose-500" />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">New projects open on the overview page after creation.</p>
            <button type="submit" className="btn-primary disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {error && <p className="mb-6 text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="card py-16 text-center text-sm text-zinc-500">Loading projects...</div>
      ) : projects.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">Project</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">Domain</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-400">Industry</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-zinc-800 transition-colors hover:bg-zinc-900/80"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/workspaces/${params.wId}/projects/${project.id}/workflows`}
                      className="font-semibold text-zinc-100 hover:text-rose-400"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{project.domain}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <img
                        src={`https://flagcdn.com/16x12/${project.country.toLowerCase()}.png`}
                        width={16}
                        height={12}
                        alt={project.country.toUpperCase()}
                        className="rounded-[1px] object-cover"
                      />
                      <span>{getCountryByCode(project.country)?.name ?? project.country}</span>
                      <span className="text-zinc-700">·</span>
                      <span>{getLanguageByCode(project.language)?.name ?? project.language}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{project.industry || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card flex flex-col items-center justify-center py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-300">No projects yet</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Create a project to start running SEO workflows for a domain.
          </p>
        </div>
      )}
    </div>
  );
}