import Link from 'next/link';
import { createKeywordWorkflow, getKeywordProjects } from '@/features/keywords/services/keywords.service';
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
            <h1 className="text-[32px] font-bold text-[#111827]">Keyword project</h1>
            <p className="mt-1 text-sm text-[#9CA3AF]">Project-scoped workspace for workflow creation and review.</p>
          </div>

          <Link
            href="/dashboard/keywords"
            className="inline-flex items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
          >
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
          <h1 className="mt-2 text-[32px] font-bold text-[#111827]">{project.name}</h1>
          <p className="mt-1 text-sm text-[#4B5563]">{project.websiteUrl}</p>
        </div>

        <Link
          href="/dashboard/keywords"
          className="inline-flex items-center justify-center rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-sm font-medium text-[#344054] transition hover:bg-[#F9FAFB]"
        >
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

      <form action={startWorkflowAction} className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        <input type="hidden" name="projectId" value={project.id} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#111827]">Start English workflow</p>
            <label className="block text-xs font-medium uppercase tracking-[0.08em] text-[#667085]" htmlFor={`country-${project.id}`}>
              Target country
            </label>
            <select
              id={`country-${project.id}`}
              name="country"
              defaultValue="ae"
              className="min-w-[180px] rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#111827]"
            >
              <option value="ae">AE</option>
              <option value="gb">GB</option>
              <option value="us">US</option>
            </select>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
          >
            Create workflow run
          </button>
        </div>

        <p className="mt-3 text-xs text-[#667085]">
          This opens the workflow shell for artifact submission and checkpoint review.
        </p>
      </form>

      <div className="rounded-xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Workflow runs</h2>
            <p className="mt-1 text-xs text-[#667085]">Reopen strategist workflow runs for this project only.</p>
          </div>
          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-medium text-[#344054]">
            {project.workflows?.length ?? 0} run{(project.workflows?.length ?? 0) === 1 ? '' : 's'}
          </span>
        </div>

        {project.workflows && project.workflows.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {project.workflows.map((workflow) => (
              <Link
                key={workflow.id}
                href={`/dashboard/keywords/${project.id}/workflows/${workflow.id}`}
                className="rounded-lg border border-[#D0D5DD] bg-[#FCFCFD] p-3 transition hover:border-[#98A2B3] hover:bg-[#F9FAFB]"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">
                      {workflow.language.toUpperCase()} / {workflow.country.toUpperCase()}
                    </p>
                    <p className="mt-1 text-xs text-[#667085]">
                      Current checkpoint: {workflow.currentCheckpoint ?? 'Not set'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                      {workflow.status.replaceAll('_', ' ')}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#667085]">
                      {new Date(workflow.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-[#9CA3AF]">No workflow runs created yet for this project.</p>
        )}
      </div>
    </div>
  );
}