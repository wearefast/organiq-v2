'use client';

import { useParams } from 'next/navigation';
import { AgentChat } from '@/features/agents/components/AgentChat';

export default function AgentsPage() {
  const params = useParams();
  const projectId = params.pId as string;

  return (
    <div className="h-[calc(100vh-64px)]">
      <AgentChat projectId={projectId} />
    </div>
  );
}
