import { Injectable } from '@nestjs/common';

export type AgentType =
  | 'content-refresh'
  | 'ai-search-visibility'
  | 'technical-issues'
  | 'keyword-opportunity'
  | 'google-vs-ai'
  | 'keyword-decay'
  | 'competitor-analysis';

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  'content-refresh': 'Content Refresh Analyzer',
  'ai-search-visibility': 'AI Search Visibility Auditor',
  'technical-issues': 'Technical Issues Summarizer',
  'keyword-opportunity': 'Keyword Opportunity Finder',
  'google-vs-ai': 'Google vs AI Search Comparator',
  'keyword-decay': 'Keyword Decay Monitor',
  'competitor-analysis': 'Competitor Analysis',
};

export const AGENT_CREDIT_COSTS: Record<AgentType, number> = {
  'content-refresh': 5,
  'ai-search-visibility': 5,
  'technical-issues': 3,
  'keyword-opportunity': 5,
  'google-vs-ai': 4,
  'keyword-decay': 3,
  'competitor-analysis': 5,
};

interface RoutePattern {
  keywords: string[];
  agentType: AgentType;
}

const ROUTE_PATTERNS: RoutePattern[] = [
  {
    keywords: ['refresh', 'update', 'outdated', 'stale', 'content decay', 'pages need updating', 'content refresh'],
    agentType: 'content-refresh',
  },
  {
    keywords: ['ai search', 'ai visibility', 'llm visibility', 'perplexity', 'chatgpt', 'ai overview', 'generative search', 'ai citation', 'cited in'],
    agentType: 'ai-search-visibility',
  },
  {
    keywords: ['technical', 'issues', 'errors', 'broken', 'audit', 'site health', 'crawl', 'speed', 'core web vitals'],
    agentType: 'technical-issues',
  },
  {
    keywords: ['opportunity', 'write next', 'new content', 'topics', 'gap', 'content ideas', 'what should i write'],
    agentType: 'keyword-opportunity',
  },
  {
    keywords: ['google vs ai', 'google traffic compare', 'traffic source', 'organic vs ai', 'channel comparison', 'compare to ai'],
    agentType: 'google-vs-ai',
  },
  {
    keywords: ['decay', 'declining', 'losing rank', 'dropping', 'keyword decay', 'lost position'],
    agentType: 'keyword-decay',
  },
  {
    keywords: ['competitor', 'competition', 'rival', 'compare competitor', 'benchmark', 'competitors'],
    agentType: 'competitor-analysis',
  },
];

@Injectable()
export class AgentRouterService {
  /**
   * Classify user prompt to an agent type using keyword matching.
   * If agentType is explicitly provided, skip classification.
   */
  classify(prompt: string, explicitType?: string): AgentType {
    if (explicitType && this.isValidAgentType(explicitType)) {
      return explicitType as AgentType;
    }

    const lowerPrompt = prompt.toLowerCase();

    let bestMatch: AgentType = 'content-refresh';
    let bestScore = 0;

    for (const pattern of ROUTE_PATTERNS) {
      const score = pattern.keywords.reduce((sum, keyword) => {
        return sum + (lowerPrompt.includes(keyword) ? 1 : 0);
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern.agentType;
      }
    }

    return bestMatch;
  }

  getAllTypes(): Array<{ type: AgentType; label: string; creditCost: number }> {
    return (Object.keys(AGENT_TYPE_LABELS) as AgentType[]).map((type) => ({
      type,
      label: AGENT_TYPE_LABELS[type],
      creditCost: AGENT_CREDIT_COSTS[type],
    }));
  }

  private isValidAgentType(type: string): boolean {
    return type in AGENT_TYPE_LABELS;
  }
}
