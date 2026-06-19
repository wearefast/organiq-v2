'use client';

import { useParams } from 'next/navigation';
import { ComingSoonOverlay } from '@/shared/components/ComingSoonOverlay';
import { WorkflowBuilder } from '@/features/agents/components/WorkflowBuilder';

export default function ScheduledWorkflowsPage() {
  const params = useParams();
  const projectId = params.pId as string;

  return (
    <ComingSoonOverlay>
      <div className="p-6 max-w-4xl mx-auto">
        <WorkflowBuilder projectId={projectId} />
      </div>
    </ComingSoonOverlay>
  );
}
