'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { WorkflowShell } from '@/features/workflow/components/workflow-shell';
import { renderArtifact } from '@/features/workflow/renderers';
import { ErrorBoundary } from '@/shared/components/error-boundary';

export default function WorkflowRunPage() {
  const params = useParams<{ runId: string }>();
  const { getToken } = useAuth();

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col">
      <ErrorBoundary>
        <WorkflowRunInner runId={params.runId} getToken={getToken} />
      </ErrorBoundary>
    </div>
  );
}

function WorkflowRunInner({
  runId,
  getToken,
}: {
  runId: string;
  getToken: () => Promise<string | null>;
}) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  return (
    <WorkflowShell
      runId={runId}
      token={token}
      renderArtifact={renderArtifact}
    />
  );
}
