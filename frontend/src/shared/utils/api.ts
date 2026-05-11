const LOCAL_DEV_API_URL = 'http://localhost:3002';
const LEGACY_LOCAL_DEV_API_URL_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):3005$/i;

// Module-level token store — set by AuthProvider on mount
let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

function normalizeApiUrl(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue.replace(/\/$/, '') : null;
}

function resolveApiUrl(): string {
  const internalApiUrl = normalizeApiUrl(process.env.API_URL ?? process.env.INTERNAL_API_URL);
  if (internalApiUrl) {
    return internalApiUrl;
  }

  const publicApiUrl = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
  if (process.env.NODE_ENV !== 'production' && publicApiUrl && LEGACY_LOCAL_DEV_API_URL_PATTERN.test(publicApiUrl)) {
    return LOCAL_DEV_API_URL;
  }

  return publicApiUrl ?? LOCAL_DEV_API_URL;
}

const API_URL = resolveApiUrl();

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}
