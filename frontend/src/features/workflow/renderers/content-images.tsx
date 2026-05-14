'use client';

interface GeneratedImage {
  index: number;
  placement: string;
  altText: string;
  prompt: string;
  base64: string;
  revisedPrompt?: string;
  size?: string;
}

interface ContentImagesData {
  images?: GeneratedImage[];
  styleNotes?: string;
}

function toDataUri(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/png;base64,${base64}`;
}

export function ContentImagesRenderer({ data }: { data: unknown }) {
  const d = data as ContentImagesData;

  if (!d?.images?.length) {
    return <p className="text-zinc-400">No images generated yet.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="text-lg font-semibold text-white">Generated Images</h3>
        <div className="mt-1 flex gap-2 text-xs">
          <span className="rounded-full bg-zinc-700 px-3 py-1 text-zinc-300">
            {d.images.length} image{d.images.length !== 1 ? 's' : ''}
          </span>
          {d.styleNotes && (
            <span className="rounded-full bg-purple-900/30 px-3 py-1 text-purple-300">
              {d.styleNotes}
            </span>
          )}
        </div>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {d.images.map((img) => (
          <div
            key={img.index}
            className="rounded-lg border border-zinc-700 bg-zinc-800/30 overflow-hidden"
          >
            {/* Image */}
            <div className="relative aspect-video bg-zinc-900">
              <img
                src={toDataUri(img.base64)}
                alt={img.altText}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                image-{img.index}
              </span>
            </div>

            {/* Metadata */}
            <div className="p-3 space-y-1.5">
              <p className="text-sm font-medium text-white">{img.altText}</p>
              {img.placement && (
                <p className="text-xs text-zinc-500">
                  <span className="text-zinc-600">Placement: </span>
                  {img.placement}
                </p>
              )}
              {img.size && (
                <span className="inline-block rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {img.size}
                </span>
              )}

              {/* Download */}
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
