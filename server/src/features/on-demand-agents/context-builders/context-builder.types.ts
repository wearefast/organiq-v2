export interface ContextBuilderResult {
  systemPrompt: string;
  dataContext: string;
  summary: string;
}

export interface ContextBuilder {
  build(projectId: string, userPrompt: string): Promise<ContextBuilderResult>;
}
