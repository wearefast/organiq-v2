import Link from 'next/link';
import { getKeywordProjects } from '@/features/keywords/services/keywords.service';

export default async function KeywordsPage() {
  let projects = [] as Awaited<ReturnType<typeof getKeywordProjects>>;
  let errorMessage: string | null = null;

  try {
    projects = await getKeywordProjects();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Failed to load keyword projects.';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-[#111827]">Keyword research</h1>
          <p className="mt-1 text-sm text-[#9CA3AF]">Create projects, review strategist workflows, and build topical maps from approved research.</p>
        </div>

        <Link
          href="/dashboard/keywords/new"
          className="inline-flex items-center justify-center rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
        >
          New project
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6 shadow-sm">
          <p className="text-sm text-[#B42318]">{errorMessage}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-[#9CA3AF]">No keyword projects yet. Create a project to start the English-first strategist workflow.</p>
          <Link
            href="/dashboard/keywords/new"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
          >
            Create project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <article key={project.id} className="rounded-xl border border-[#E8EAF0] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">{project.name}</h2>
                  <p className="mt-1 text-sm text-[#4B5563]">{project.websiteUrl}</p>
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

              <div className="mt-6 rounded-xl border border-[#E4E7EC] bg-[#FCFCFD] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">Project workspace</p>
                    <p className="mt-1 text-xs text-[#667085]">
                      Open the dedicated project space to start workflows and review run history without other projects in view.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#344054]">
                      {project.workflows?.length ?? 0} run{(project.workflows?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                    <Link
                      href={`/dashboard/keywords/${project.id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1F2937]"
                    >
                      Open project
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
