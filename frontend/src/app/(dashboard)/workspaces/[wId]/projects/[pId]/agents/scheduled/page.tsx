'use client';

import { useParams } from 'next/navigation';
import { WorkflowBuilder } from '@/features/agents/components/WorkflowBuilder';

export default function ScheduledWorkflowsPage() {
  const params = useParams();
  const projectId = params.pId as string;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <WorkflowBuilder projectId={projectId} />
    </div>
  );
}
