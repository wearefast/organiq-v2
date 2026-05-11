import Link from 'next/link';
import { Plus, Key, ArrowRight } from 'lucide-react';
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
          <h1 className="text-[32px] font-bold leading-tight text-[var(--text-primary)]">Keyword research</h1>
          <p className="mt-1 text-sm text-[var(--text-body)]">Create projects, review strategist workflows, and build topical maps.</p>
        </div>

        <Link
          href="/dashboard/keywords/new"
          className="btn-primary gap-2 px-4"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] p-6 shadow-sm">
          <p className="text-sm text-[#B42318]">{errorMessage}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-16 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F6FA]">
            <Key className="h-5 w-5 text-[#9CA3AF]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-[#111827]">No keyword projects yet</h3>
          <p className="mt-1 text-sm text-[#6B7280]">Create a project to start the English-first strategist workflow.</p>
          <Link
            href="/dashboard/keywords/new"
            className="btn-primary mt-6 gap-2 px-4"
          >
            <Plus className="h-4 w-4" />
            Create project
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E8EAF0] bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#F3F4F6] bg-[#FAFAFB]">
                <th className="table-header-cell px-5 py-3">Project</th>
                <th className="table-header-cell px-5 py-3">Seeds</th>
                <th className="table-header-cell px-5 py-3">Workflows</th>
                <th className="table-header-cell px-5 py-3">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-[#F3F4F6] transition-colors last:border-b-0 hover:bg-[#FAFAFB]">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-[#111827]">{project.name}</p>
                      <p className="mt-0.5 text-xs text-[#9CA3AF]">{project.websiteUrl}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {project.seedKeywords.length > 0 ? (
                        <>
                          {project.seedKeywords.slice(0, 3).map((keyword) => (
                            <span
                              key={keyword}
                              className="rounded-full border border-[#E8EAF0] bg-[#F9FAFB] px-2.5 py-0.5 text-[11px] text-[#4B5563]"
                            >
                              {keyword}
                            </span>
                          ))}
                          {project.seedKeywords.length > 3 && (
                            <span className="rounded-full bg-[#F4F6FA] px-2.5 py-0.5 text-[11px] font-medium text-[#667085]">
                              +{project.seedKeywords.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-[#F4F6FA] px-2.5 py-0.5 text-xs font-medium text-[#344054]">
                      {project.workflows?.length ?? 0} run{(project.workflows?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#9CA3AF]">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/dashboard/keywords/${project.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF] transition-colors hover:text-[#111827]"
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
