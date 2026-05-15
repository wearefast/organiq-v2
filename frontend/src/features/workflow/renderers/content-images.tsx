'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/shared/utils/api';
import type { WorkflowStep, StepToolCall } from '../types';

interface GenerateImageOutput {
  base64: string;
  revisedPrompt?: string;
}

interface ImageEntry {
  index: number;
  base64: string;
  revisedPrompt: string;
  input: { prompt?: string; size?: string };
}

function toDataUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/png;base64,${base64}`;
}

export function ContentImagesRenderer({
  data,
  allSteps,
}: {
  data: unknown;
  allSteps?: WorkflowStep[];
}) {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const step = allSteps?.find((s) => s.stepKey === 'content-images');
    if (!step) {
      setLoading(false);
      return;
    }

    apiFetch<StepToolCall[]>(`/workflows/steps/${step.id}/tool-calls`)
      .then((calls) => {
        const imgCalls = calls.filter((c) => c.toolName === 'generate_image' && c.output);
        const entries: ImageEntry[] = imgCalls.map((c, i) => {
          const out = c.output as GenerateImageOutput;
          const inp = c.input as { prompt?: string; size?: string };
          return {
            index: i,
            base64: out.base64 ?? '',
            revisedPrompt: out.revisedPrompt ?? '',
            input: inp,
          };
        });
        setImages(entries.filter((e) => e.base64));
      })
      .catch(() => {/* silently fall through to empty state */})
      .finally(() => setLoading(false));
  }, [allSteps]);

  if (loading) {
    return <p className="text-zinc-400 text-sm">Loading images…</p>;
  }

  if (!images.length) {
    return <p className="text-zinc-400 text-sm">No images generated yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="text-lg font-semibold text-white">Generated Images</h3>
        <span className="mt-1 inline-block rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300">
          {images.length} image{images.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {images.map((img) => (
          <div
            key={img.index}
            className="rounded-lg border border-zinc-700 bg-zinc-800/30 overflow-hidden"
          >
            <div className="relative aspect-video bg-zinc-900">
              <img
                src={toDataUri(img.base64)}
                alt={img.revisedPrompt || `image-${img.index}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                image-{img.index}
              </span>
            </div>
            <div className="p-3 space-y-1.5">
              {img.input.size && (
                <span className="inline-block rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {img.input.size}
                </span>
              )}
              {img.revisedPrompt && (
                <p className="text-xs text-zinc-500 line-clamp-2">{img.revisedPrompt}</p>
              )}
              <div className="pt-1">
                <a
                  href={toDataUri(img.base64)}
                  download={`image-${img.index}.png`}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Download PNG
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
