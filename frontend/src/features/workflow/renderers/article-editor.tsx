'use client';

import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { MarkdownPreview } from '@/shared/components/markdown-preview';

interface ArticleEditorProps {
  content: string;
  imageMap?: Record<string, string>;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export function ArticleEditor({ content, imageMap, onSave, onCancel }: ArticleEditorProps) {
  const [value, setValue] = useState(content);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      onSave(value);
    } finally {
      setSaving(false);
    }
  }, [value, onSave]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-zinc-400">Edit Article</h4>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-2 gap-3 rounded border border-zinc-700">
        {/* Editor */}
        <div className="min-h-[500px] border-r border-zinc-700">
          <Editor
            height="500px"
            defaultLanguage="markdown"
            value={value}
            onChange={(v) => setValue(v ?? '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              lineNumbers: 'on',
              fontSize: 13,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        {/* Live preview */}
        <div className="max-h-[500px] overflow-y-auto px-5 py-4">
          <MarkdownPreview content={value} imageMap={imageMap} />
        </div>
      </div>
    </div>
  );
}
