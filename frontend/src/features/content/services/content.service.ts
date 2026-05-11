import { apiFetch } from '@/shared/utils/api';

export interface ContentBriefPayload {
  targetKeyword?: string;
  pillar?: string;
  objective?: string;
  audience?: string;
  outline?: string[];
  editorialNotes?: string;
  faqs?: string[];
  internalLinks?: string[];
  titleOptions?: string[];
  suggestedUrlPath?: string;
  market?: {
    country?: string;
    language?: string;
  };
  [key: string]: unknown;
}

export interface ContentArticleInputPayload {
  title?: string;
  targetKeyword?: string;
  pillar?: string;
  articleSections?: string[];
  draftChecklist?: string[];
  recommendedAction?: string;
  contentType?: string;
  suggestedUrlPath?: string;
  internalLinkTargets?: string[];
  market?: {
    country?: string;
    language?: string;
  };
  [key: string]: unknown;
}

export interface ContentPiece {
  id: string;
  title: string;
  status: string;
  keywordId: string;
  workflowRunId?: string | null;
  brief?: ContentBriefPayload | null;
  body?: string | null;
  language?: string;
  country?: string | null;
  reviewNotes?: {
    articleInput?: ContentArticleInputPayload;
    [key: string]: unknown;
  } | null;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
}

export async function getContentPieces(): Promise<ContentPiece[]> {
  return apiFetch<ContentPiece[]>('/content');
}

export async function getContentPiece(id: string): Promise<ContentPiece> {
  return apiFetch<ContentPiece>(`/content/${id}`);
}

export async function generateBrief(keywordId: string): Promise<void> {
  await apiFetch(`/content/${keywordId}/generate-brief`, { method: 'POST' });
}

export async function generateArticle(keywordId: string): Promise<void> {
  await apiFetch(`/content/${keywordId}/generate-article`, { method: 'POST' });
}
