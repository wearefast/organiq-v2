import { ContentPipelineHeader } from '@/features/content/components/content-pipeline-header';

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <ContentPipelineHeader />
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
