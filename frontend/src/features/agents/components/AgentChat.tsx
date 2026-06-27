'use client';

import { useState, useRef } from 'react';
import { runAgent, type AgentRunResponse, type AgentRunHistory } from '../services/agents.service';

interface AgentChatProps {
  projectId: string;
}

const QUICK_PROMPTS = [
  { label: 'Content Refresh', prompt: 'Which pages need to be refreshed?', type: 'content-refresh', creditMin: 5, creditMax: 7 },
  { label: 'AI Visibility', prompt: 'How am I performing in AI search?', type: 'ai-search-visibility', creditMin: 5, creditMax: 7 },
  { label: 'Technical Issues', prompt: 'What are my most critical technical issues?', type: 'technical-issues', creditMin: 3, creditMax: 4 },
  { label: 'Content Ideas', prompt: 'What content should I write next?', type: 'keyword-opportunity', creditMin: 5, creditMax: 7 },
  { label: 'Google vs AI', prompt: 'How does my Google traffic compare to AI search?', type: 'google-vs-ai', creditMin: 4, creditMax: 6 },
  { label: 'Keyword Decay', prompt: 'Which keywords are losing rankings?', type: 'keyword-decay', creditMin: 3, creditMax: 4 },
  { label: 'Competitors', prompt: 'How do I compare to competitors?', type: 'competitor-analysis', creditMin: 5, creditMax: 7 },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentLabel?: string;
  recommendations?: Array<{ title: string; rationale: string; action?: string }>;
  dataContextSummary?: string;
  creditCost?: number;
  durationMs?: number;
}

export function AgentChat({ projectId }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (prompt: string, agentType?: string) => {
    if (!prompt.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await runAgent(projectId, prompt, agentType);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        agentLabel: result.agentLabel,
        recommendations: result.recommendations,
        dataContextSummary: result.dataContextSummary,
        creditCost: result.creditCost,
        durationMs: result.durationMs,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Agent run failed'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">AI Agents</h2>
            <p className="text-gray-500 mb-6">Ask a question or pick a quick-start prompt below.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.type}
                  onClick={() => handleSubmit(qp.prompt, qp.type)}
                  className="flex flex-col items-start px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                >
                  <span>{qp.label}</span>
                  <span className="text-[10px] text-indigo-400 mt-0.5">{qp.creditMin}–{qp.creditMax} credits</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}
            >
              {msg.agentLabel && (
                <div className="text-xs font-medium text-indigo-600 mb-1">{msg.agentLabel}</div>
              )}
              {msg.dataContextSummary && (
                <div className="text-xs text-gray-400 mb-2">📊 {msg.dataContextSummary}</div>
              )}
              <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-600">Recommendations:</div>
                  {msg.recommendations.map((rec, j) => (
                    <div key={j} className="bg-gray-50 rounded p-2 text-xs">
                      <div className="font-medium text-gray-800">{rec.title}</div>
                      <div className="text-gray-500 mt-0.5">{rec.rationale}</div>
                    </div>
                  ))}
                </div>
              )}
              {msg.creditCost !== undefined && (
                <div className="mt-2 text-xs text-gray-400">
                  {msg.creditCost} credits · {((msg.durationMs ?? 0) / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-4 max-w-[80%]">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-pulse">Pulling your data...</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(input);
              }
            }}
            placeholder="Ask about your site's performance..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
