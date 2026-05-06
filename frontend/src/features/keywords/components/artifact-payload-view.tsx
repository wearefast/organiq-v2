import { type ReactNode } from 'react';

const ITEM_TITLE_KEYS = ['headline', 'title', 'keyword', 'pillar', 'domain', 'url', 'stepKey', 'parentTopic', 'targetKeyword', 'id'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function hasArtifactPayloadContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some((entry) => hasArtifactPayloadContent(entry));
  if (isRecord(value)) return Object.values(value).some((entry) => hasArtifactPayloadContent(entry));
  return false;
}

function formatArtifactLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPrimitiveValue(value: string | number | boolean) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'string') {
    return value.trim().replaceAll('_', ' ');
  }

  return String(value);
}

function getArrayItemTitle(value: unknown, index: number) {
  if (isRecord(value)) {
    for (const key of ITEM_TITLE_KEYS) {
      const itemValue = value[key];

      if (typeof itemValue === 'string' && itemValue.trim().length > 0) {
        return formatPrimitiveValue(itemValue);
      }

      if (typeof itemValue === 'number') {
        return `${formatArtifactLabel(key)} ${itemValue}`;
      }
    }
  }

  return `Item ${index + 1}`;
}

function renderArtifactValue(value: unknown, depth = 0): ReactNode {
  if (!hasArtifactPayloadContent(value)) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <p className="whitespace-pre-wrap break-words text-sm text-[#111827]">{formatPrimitiveValue(value)}</p>;
  }

  if (Array.isArray(value)) {
    const items = value.filter((entry) => hasArtifactPayloadContent(entry));

    if (items.every((entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')) {
      return (
        <ul className="grid gap-2">
          {items.map((entry, index) => (
            <li key={`${depth}-${index}`} className="rounded-md border border-[#E4E7EC] bg-[#FCFCFD] px-3 py-2 text-sm text-[#111827]">
              {formatPrimitiveValue(entry as string | number | boolean)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="grid gap-3">
        {items.map((entry, index) => (
          <section key={`${depth}-${index}`} className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">{getArrayItemTitle(entry, index)}</p>
            <div className="mt-2">{renderArtifactValue(entry, depth + 1)}</div>
          </section>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, entry]) => hasArtifactPayloadContent(entry));

    if (depth === 0) {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {entries.map(([key, entry]) => (
            <section key={key} className="rounded-lg border border-[#E4E7EC] bg-[#FCFCFD] p-3">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">{formatArtifactLabel(key)}</p>
              <div className="mt-2">{renderArtifactValue(entry, depth + 1)}</div>
            </section>
          ))}
        </div>
      );
    }

    return (
      <dl className="grid gap-3 sm:grid-cols-2">
        {entries.map(([key, entry]) => (
          <div key={`${depth}-${key}`}>
            <dt className="text-xs font-medium uppercase tracking-[0.08em] text-[#667085]">{formatArtifactLabel(key)}</dt>
            <dd className="mt-1.5">{renderArtifactValue(entry, depth + 1)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return null;
}

export function ArtifactPayloadView({ payload }: { payload: Record<string, unknown> | null | undefined }) {
  if (!hasArtifactPayloadContent(payload)) {
    return null;
  }

  return <div>{renderArtifactValue(payload)}</div>;
}