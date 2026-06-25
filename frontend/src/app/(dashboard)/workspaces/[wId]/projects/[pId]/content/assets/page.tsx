'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { setAuthToken, apiFetch } from '@/shared/utils/api';
import { Upload, Trash2, X, Download, Image as ImageIcon, FileText, Film, Music, File } from 'lucide-react';
import { useContentStep } from '@/features/content/hooks/use-content-step';

interface GeneratedImage {
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

interface ProjectAsset {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  base64: string;
  createdAt: string;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.startsWith('video/')) return <Film className="h-5 w-5" />;
  if (mimeType.startsWith('audio/')) return <Music className="h-5 w-5" />;
  if (mimeType.startsWith('text/') || mimeType.includes('pdf')) return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetsPage() {
  const params = useParams();
  const projectId = params.pId as string;
  const { getToken } = useAuth();

  const [tab, setTab] = useState<'generated' | 'uploaded'>('generated');

  const {
    stepStatus: imagesStepStatus,
    artifactData: imagesArtifact,
    approving,
    approve,
  } = useContentStep(projectId, 'content-images');

  // Generated images state
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [search, setSearch] = useState('');

  // Uploaded assets state
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ProjectAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
    loadAssets();
  }, [projectId]);

  async function loadImages() {
    setImagesLoading(true);
    try {
      setAuthToken(await getToken());
      const data = await apiFetch<GeneratedImage[]>(`/projects/${projectId}/content/all-images`);
      setImages(data);
    } catch (err) {
      console.error('Failed to load generated images:', err);
    } finally {
      setImagesLoading(false);
    }
  }

  async function loadAssets() {
    setAssetsLoading(true);
    try {
      setAuthToken(await getToken());
      const data = await apiFetch<ProjectAsset[]>(`/projects/${projectId}/content/project-assets`);
      setAssets(data);
    } catch (err) {
      console.error('Failed to load uploaded assets:', err);
    } finally {
      setAssetsLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploadError(null);
    setUploading(true);

    try {
      setAuthToken(await getToken());
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URL prefix (data:<mime>;base64,)
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await apiFetch(`/projects/${projectId}/content/project-assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            base64,
          }),
        });
      }
      await loadAssets();
    } catch (err) {
      setUploadError('Upload failed. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteAsset(asset: ProjectAsset) {
    try {
      setAuthToken(await getToken());
      await apiFetch(`/projects/${projectId}/content/project-assets/${asset.id}`, {
        method: 'DELETE',
      });
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      if (selectedAsset?.id === asset.id) setSelectedAsset(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  const filteredImages = images.filter((img) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (img.altText ?? '').toLowerCase().includes(q) ||
      (img.prompt ?? '').toLowerCase().includes(q) ||
      img.contentPieceTitle.toLowerCase().includes(q)
    );
  });

  // Images awaiting approval: show artifact gallery for review before materialisation
  if (imagesStepStatus === 'awaiting_approval') {
    const artifactImages =
      (imagesArtifact as { images?: Array<{ index: number; base64: string; altText?: string; prompt?: string; size?: string }> })
        ?.images ?? [];
    const toDataUri = (b64: string) =>
      b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Your images are ready for review
              </p>
              <p className="text-xs text-zinc-500">
                Review the generated images below, then approve to save them to your assets.
              </p>
            </div>
          </div>
          <button
            onClick={approve}
            disabled={approving}
            className="shrink-0 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {approving ? 'Approving…' : 'Approve & Save →'}
          </button>
        </div>
        {artifactImages.length === 0 ? (
          <p className="text-sm text-zinc-500">No images in artifact.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artifactImages.map((img) => (
              <div
                key={img.index}
                className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
              >
                <img
                  src={toDataUri(img.base64)}
                  alt={img.altText ?? `Image ${img.index + 1}`}
                  className="w-full object-cover"
                />
                {img.altText && (
                  <div className="p-2">
                    <p className="text-xs text-zinc-400">{img.altText}</p>
                    {img.size && (
                      <p className="mt-0.5 text-[10px] text-zinc-600">{img.size}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assets</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {images.length} generated Â· {assets.length} uploaded
          </p>
        </div>
        {tab === 'uploaded' && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploadingâ€¦' : 'Upload Files'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-800/60 p-1 w-fit border border-zinc-700">
        <button
          onClick={() => setTab('generated')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'generated'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Generated
        </button>
        <button
          onClick={() => setTab('uploaded')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === 'uploaded'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Uploaded
        </button>
      </div>

      {/* â”€â”€ Generated Tab â”€â”€ */}
      {tab === 'generated' && (
        <div className="space-y-4">
          {imagesStepStatus === 'running' && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <div>
                <p className="text-sm font-medium text-blue-300">Generating your images…</p>
                <p className="text-xs text-zinc-500">
                  This usually takes 1–2 minutes. This page will update automatically.
                </p>
              </div>
            </div>
          )}
          <input
            type="text"
            placeholder="Search by alt text, prompt, or articleâ€¦"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
          />

          {imagesLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-12 text-center">
              <p className="text-zinc-400">{images.length === 0 ? 'No images generated yet.' : 'No results match your search.'}</p>
              {images.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500">Images are generated during the content article workflow step.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredImages.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(img)}
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
        </div>
      )}

      {/* â”€â”€ Uploaded Tab â”€â”€ */}
      {tab === 'uploaded' && (
        <div className="space-y-4">
          {uploadError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-2 text-sm text-red-300">
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {assetsLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
            </div>
          ) : assets.length === 0 ? (
            <div
              className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-800/20 p-16 text-center cursor-pointer hover:border-zinc-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-zinc-500 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">No assets uploaded yet</p>
              <p className="mt-1 text-xs text-zinc-500">Click to upload images, documents, or other files</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {assets.map((asset) => {
                const isImage = asset.mimeType.startsWith('image/');
                return (
                  <div
                    key={asset.id}
                    className="group relative overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 aspect-square hover:border-zinc-500 transition-all cursor-pointer"
                    onClick={() => setSelectedAsset(asset)}
                  >
                    {isImage ? (
                      <img
                        src={`data:${asset.mimeType};base64,${asset.base64}`}
                        alt={asset.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
                        {fileIcon(asset.mimeType)}
                        <span className="text-xs text-center px-2 line-clamp-2">{asset.name}</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[11px] text-white line-clamp-1 text-left">{asset.name}</p>
                      <p className="text-[10px] text-zinc-400">{formatBytes(asset.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAsset(asset); }}
                      className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:bg-red-900/70 hover:text-red-300 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Generated Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`data:image/png;base64,${selectedImage.base64}`}
              alt={selectedImage.altText ?? 'Generated image'}
              className="w-full object-contain max-h-[60vh]"
            />
            <div className="p-4 space-y-2">
              <p className="text-sm font-medium text-zinc-100">{selectedImage.altText || 'â€”'}</p>
              {selectedImage.prompt && (
                <p className="text-xs text-zinc-400 leading-relaxed">{selectedImage.prompt}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-zinc-500 pt-1">
                <span>From: <span className="text-zinc-300">{selectedImage.contentPieceTitle}</span></span>
                {selectedImage.size && <span>{selectedImage.size}</span>}
                <span>{new Date(selectedImage.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`data:image/png;base64,${selectedImage.base64}`}
                  download={`image-${selectedImage.index}.png`}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-600"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <button onClick={() => setSelectedImage(null)} className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Asset Preview */}
      {selectedAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAsset.mimeType.startsWith('image/') ? (
              <img
                src={`data:${selectedAsset.mimeType};base64,${selectedAsset.base64}`}
                alt={selectedAsset.name}
                className="w-full object-contain max-h-[60vh]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
                {fileIcon(selectedAsset.mimeType)}
                <span className="text-sm">{selectedAsset.name}</span>
              </div>
            )}
            <div className="p-4 space-y-2">
              <p className="text-sm font-medium text-zinc-100">{selectedAsset.name}</p>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>{selectedAsset.mimeType}</span>
                <span>{formatBytes(selectedAsset.size)}</span>
                <span>{new Date(selectedAsset.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <a
                  href={`data:${selectedAsset.mimeType};base64,${selectedAsset.base64}`}
                  download={selectedAsset.name}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-600"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteAsset(selectedAsset); }}
                  className="flex items-center gap-1.5 rounded-lg bg-red-900/40 border border-red-700/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button onClick={() => setSelectedAsset(null)} className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">
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
