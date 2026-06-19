'use client';

import { useParams } from 'next/navigation';
import { ComingSoonOverlay } from '@/shared/components/ComingSoonOverlay';
import { AgentChat } from '@/features/agents/components/AgentChat';

export default function AgentsPage() {
  const params = useParams();
  const projectId = params.pId as string;

  return (
    <ComingSoonOverlay>
      <div data-tour="agent-chat" className="h-[calc(100vh-64px)]">
        <AgentChat projectId={projectId} />
      </div>
    </ComingSoonOverlay>
  );
}
