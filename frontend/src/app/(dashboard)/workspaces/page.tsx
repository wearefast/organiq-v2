export default function WorkspacesPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-page-title text-zinc-100">Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your client workspaces and their projects.
          </p>
        </div>
        <button className="btn-primary">New Workspace</button>
      </div>

      {/* Empty state */}
      <div className="card flex flex-col items-center justify-center py-16">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
          <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6A1.125 1.125 0 012.25 10.875v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-zinc-300">No workspaces yet</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Create your first workspace to start managing SEO projects.
        </p>
      </div>
    </div>
  );
}
