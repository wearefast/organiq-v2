export default function ProjectsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-zinc-100">Projects</h1>
          <p className="mt-1 text-sm text-zinc-500">
            SEO projects within this workspace.
          </p>
        </div>
        <button className="btn-primary">New Project</button>
      </div>

      {/* Empty state */}
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
    </div>
  );
}
