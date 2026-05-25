'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ContentRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/workspaces/${params.wId}/projects/${params.pId}/content/articles`);
  }, [router, params.wId, params.pId]);
  return null;
}
