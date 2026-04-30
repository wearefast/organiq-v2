import { apiFetch } from '@/shared/utils/api';

interface ContentPiece {
  id: string;
  title: string;
  status: string;
  keywordId: string;
}

export async function getContentPieces(): Promise<ContentPiece[]> {
  return apiFetch<ContentPiece[]>('/content');
}

export async function generateBrief(keywordId: string): Promise<void> {
  await apiFetch(`/content/${keywordId}/generate-brief`, { method: 'POST' });
}

export async function generateArticle(keywordId: string): Promise<void> {
  await apiFetch(`/content/${keywordId}/generate-article`, { method: 'POST' });
}
