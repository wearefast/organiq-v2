'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
export default function RedirectPage() {
  const router = useRouter();
  const p = useParams<{ wId: string; pId: string }>();
  useEffect(() => {
    router.replace(`/workspaces/${p.wId}/projects/${p.pId}/ai-search/llm-audit`);
  }, [router, p.wId, p.pId]);
  return null;
}
