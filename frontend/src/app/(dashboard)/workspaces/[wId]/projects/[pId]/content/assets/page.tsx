'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';

interface AssetImage {
  id: string;
  contentPieceId: string;
  contentPieceTitle: string;
  index: number;
  altText?: string;
  prompt?: string;
  base64: string;
  size?: string;
  createdAt: string;
}

export default function AssetsPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const [images, setImages] = useState<AssetImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AssetImage | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadImages(); }, [projectId]);

  async function loadImages() {
    setLoading(true);
    try {
      setAuthToken(await getToken());
      const data = await apiFetch<AssetImage[]>(`/projects/${projectId}/content/all-images`);
      setImages(data);
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = images.filter((img) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (img.altText ?? '').toLowerCase().includes(q) ||
      (img.prompt ?? '').toLowerCase().includes(q) ||
      img.contentPieceTitle.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assets</h1>
          <p className="text-sm text-zinc-400 mt-0.5">{images.length} image{images.length !== 1 ? 's' : ''} generated</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by alt text, prompt, or article…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-12 text-center">
          <p className="text-zinc-400">{images.length === 0 ? 'No images generated yet.' : 'No results match your search.'}</p>
          {images.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">Images are generated during the content article workflow step.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((img) => (
            <button
              key={img.id}
              onClick={() => setSelected(img)}
              className="group relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 aspect-square hover:border-zinc-500 transition-all"
            >
              <img
                src={`data:image/png;base64,${img.base64}`}
                alt={img.altText ?? 'Generated image'}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[11px] text-white line-clamp-2 text-left">{img.altText || img.contentPieceTitle}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`data:image/png;base64,${selected.base64}`}
              alt={selected.altText ?? 'Generated image'}
              className="w-full object-contain max-h-[60vh]"
            />
            <div className="p-4 space-y-2">
              <p className="text-sm font-medium text-zinc-100">{selected.altText || '—'}</p>
              {selected.prompt && (
                <p className="text-xs text-zinc-400 leading-relaxed">{selected.prompt}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
                <span>From: <span className="text-zinc-300">{selected.contentPieceTitle}</span></span>
                {selected.size && <span>{selected.size}</span>}
                <span>{new Date(selected.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`data:image/png;base64,${selected.base64}`}
                  download={`image-${selected.index}.png`}
                  className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-600"
                >
                  Download
                </a>
                <button onClick={() => setSelected(null)} className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
