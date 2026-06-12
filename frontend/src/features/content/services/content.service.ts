import { apiFetch } from '@/shared/utils/api';

export interface ContentPiece {
  id: string;
  projectId: string;
  workflowRunId?: string;
  keywordId?: string;
  topicalMapId?: string;
  sourceStepKey?: string;
  type: 'brief' | 'article';
  status: 'draft' | 'review' | 'approved' | 'published';
  title: string;
  briefData?: unknown;
  articleData?: unknown;
  scores?: {
    readability?: number;
    seo_quality?: number;
    citability?: number;
    content_length?: number;
    overall?: number;
  };
  wordCount?: number;
  scheduledPublishAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentStats {
  total: number;
  byType: { brief: number; article: number };
  byStatus: { draft: number; review: number; approved: number; published: number };
  totalWordCount: number;
}

export function fetchContent(projectId: string): Promise<ContentPiece[]> {
  return apiFetch(`/projects/${projectId}/content`);
}

export function fetchContentPiece(projectId: string, id: string): Promise<ContentPiece> {
  return apiFetch(`/projects/${projectId}/content/${id}`);
}

export function fetchContentStats(projectId: string): Promise<ContentStats> {
  return apiFetch(`/projects/${projectId}/content/stats`);
}

export function createContentPiece(
  projectId: string,
  data: {
    type: 'brief' | 'article';
    title: string;
    workflowRunId?: string;
    keywordId?: string;
    briefData?: unknown;
    articleData?: unknown;
  },
): Promise<ContentPiece> {
  return apiFetch(`/projects/${projectId}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateContentPiece(
  projectId: string,
  id: string,
  data: Partial<Pick<ContentPiece, 'title' | 'status' | 'briefData' | 'articleData' | 'scores' | 'wordCount'>>,
): Promise<ContentPiece> {
  return apiFetch(`/projects/${projectId}/content/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateContentStatus(
  projectId: string,
  id: string,
  status: ContentPiece['status'],
): Promise<ContentPiece> {
  return apiFetch(`/projects/${projectId}/content/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export function deleteContentPiece(projectId: string, id: string): Promise<{ deleted: boolean }> {
  return apiFetch(`/projects/${projectId}/content/${id}`, {
    method: 'DELETE',
  });
}

export function bulkCreateContent(
  projectId: string,
  items: Array<{
    type: 'brief' | 'article';
    title: string;
    workflowRunId?: string;
    keywordId?: string;
    briefData?: unknown;
  }>,
): Promise<ContentPiece[]> {
  return apiFetch(`/projects/${projectId}/content/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

export interface ContentImage {
  id: string;
  contentPieceId: string;
  index: number;
  altText?: string;
  prompt?: string;
  base64?: string;
  revisedPrompt?: string;
  size?: string;
  createdAt: string;
}

export function fetchContentImages(projectId: string, contentPieceId: string): Promise<ContentImage[]> {
  return apiFetch(`/projects/${projectId}/content/${contentPieceId}/images`);
}
