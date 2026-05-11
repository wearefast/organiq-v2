import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createKeywordWorkflow, getKeywordProjects } from '@/features/keywords/services/keywords.service';
import { StatusBadge } from '@/shared/components/status-badge';
import { notFound, redirect } from 'next/navigation';

async function startWorkflowAction(formData: FormData) {
  'use server';

  const projectId = String(formData.get('projectId') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim().toLowerCase();

  if (!projectId || !country) {
    throw new Error('Project and country are required to start a workflow.');
  }

  const workflow = await createKeywordWorkflow(projectId, {
    language: 'en',
    country,
  });

  redirect(`/dashboard/keywords/${projectId}/workflows/${workflow.id}`);
}

function formatLanguageLabel(language: string) {
  const normalized = language.trim().toLowerCase();

  if (normalized === 'en') return 'English';
  if (normalized === 'ar') return 'Arabic';

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default async function KeywordProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let projects = [] as Awaited<ReturnType<typeof getKeywordProjects>>;
  let errorMessage: string | null = null;

  try {
    projects = await getKeywordProjects();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Failed to load keyword project.';
  }

  if (errorMessage) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-tight text-[var(--text-primary)]">Keyword project</h1>
            <p className="mt-1 text-sm text-[var(--text-body)]">Project-scoped workspace for workflow creation and review.</p>
          </div>

          <Link
            href="/dashboard/keywords"
            className="btn-secondary gap-2 px-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all projects
          </Link>
        </div>

        <div className="rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6 shadow-sm">
          <p className="text-sm text-[#B42318]">{errorMessage}</p>
        </div>
      </div>
    );
  }

  const project = projects.find((candidate) => candidate.id === projectId);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">Keyword project workspace</p>
          <h1 className="mt-2 text-[32px] font-bold leading-tight text-[var(--text-primary)]">{project.name}</h1>
          <p className="mt-1 text-sm text-[#4B5563]">{project.websiteUrl}</p>
        </div>

        <Link
          href="/dashboard/keywords"
          className="btn-secondary gap-2 px-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all projects
        </Link>
      </div>

      <article className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Project overview</h2>
            <p className="mt-1 text-sm text-[#667085]">
              This workspace is scoped to one project, so workflow creation and history stay separate from the rest of the account.
            </p>
          </div>

          <div className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
            {project.seedKeywords.length} seed keyword{project.seedKeywords.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {project.seedKeywords.length > 0 ? (
            project.seedKeywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-1 text-xs text-[#344054]"
              >
                {keyword}
              </span>
            ))
          ) : (
            <span className="text-xs text-[#9CA3AF]">No seed keywords captured yet.</span>
          )}
        </div>

        <p className="mt-4 text-xs text-[#9CA3AF]">
          Created {new Date(project.createdAt).toLocaleDateString()}
        </p>
      </article>

      {/* Competitors */}
      {project.competitors && project.competitors.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#E8EAF0] bg-white px-6 py-4 shadow-sm">
          <p className="mr-2 text-[11px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Competitors</p>
          {project.competitors.map((comp: string) => (
            <span key={comp} className="inline-flex items-center gap-1.5 rounded-full border border-[#D0D5DD] bg-[#F9FAFB] px-3 py-1 text-xs text-[#344054]">
              {comp}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#F3F4F6] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#111827]">Workflow runs</h2>
          <form action={startWorkflowAction} className="flex items-center gap-3">
            <input type="hidden" name="projectId" value={project.id} />
            <select
              name="country"
              defaultValue="ae"
              className="h-9 rounded-lg border border-[#E8EAF0] bg-[#F8F9FC] px-3 text-sm text-[#4B5563] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            >
              <option value="ae">AE</option>
              <option value="gb">GB</option>
              <option value="us">US</option>
            </select>
            <button
              type="submit"
              className="btn-primary px-4"
            >
              Start new workflow
            </button>
          </form>
        </div>

        {project.workflows && project.workflows.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6] bg-[#FAFAFB]">
                <th className="table-header-cell px-5 py-3">#</th>
                <th className="table-header-cell px-5 py-3">Market</th>
                <th className="table-header-cell px-5 py-3">Status</th>
                <th className="table-header-cell px-5 py-3">Current Step</th>
                <th className="table-header-cell px-5 py-3">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {project.workflows.map((workflow, i) => (
                <tr key={workflow.id} className="border-b border-[#F3F4F6] transition-colors last:border-b-0 hover:bg-[#FAFAFB]">
                  <td className="px-5 py-3.5 font-medium text-[#111827]">#{project.workflows!.length - i}</td>
                  <td className="px-5 py-3.5 text-[#4B5563]">
                    {workflow.country.toUpperCase()} · {formatLanguageLabel(workflow.language)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={workflow.status} />
                  </td>
                  <td className="px-5 py-3.5 text-[#4B5563]">
                    {workflow.currentCheckpoint?.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-[#9CA3AF]">
                    {new Date(workflow.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/dashboard/keywords/${project.id}/workflows/${workflow.id}`}
                      className="text-xs font-medium text-[#9CA3AF] transition-colors hover:text-[#111827]"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-[#9CA3AF]">No workflow runs created yet.</p>
        )}
      </div>
    </div>
  );
}