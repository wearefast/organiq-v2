const LOCAL_DEV_API_URL = 'http://localhost:3002';
const LEGACY_LOCAL_DEV_API_URL_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1):3005$/i;

/**
 * Structured API error with parsed message and status code.
 * Backend throws exceptions that NestJS converts to JSON responses.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly message: string;
  readonly errorType?: string;

  constructor(statusCode: number, message: string, errorType?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.message = message;
    this.errorType = errorType;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static parse(statusCode: number, body: string): ApiError {
    try {
      const json = JSON.parse(body);
      // NestJS error response format: { message, error, statusCode }
      if (json.message && typeof json.message === 'string') {
        return new ApiError(statusCode, json.message, json.error);
      }
    } catch {
      // Fall back to raw body if not JSON
    }
    return new ApiError(statusCode, body);
  }
}

// Module-level token store — set by AuthProvider on mount
let _authToken: string | null = null;
let _getTokenFn: (() => Promise<string | null>) | null = null;

// Resolves the first time a real token is stored (Clerk initialized).
// Already-resolved after that, so subsequent awaits return immediately.
let _firstTokenResolve: (() => void) | null = null;
const _firstTokenReady: Promise<void> = new Promise<void>((resolve) => {
  _firstTokenResolve = resolve;
});

export function setAuthToken(token: string | null): void {
  _authToken = token;
  if (token && _firstTokenResolve) {
    _firstTokenResolve();
    _firstTokenResolve = null;
  }
}

export function setGetTokenFn(fn: (() => Promise<string | null>) | null): void {
  _getTokenFn = fn;
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

/** The resolved API base URL. Import this instead of hardcoding the URL. */
export { API_URL };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // If Clerk hasn't initialized yet, wait up to 5s for the first token.
  // This prevents 401s on initial page load before AuthSync has run.
  if (!_authToken) {
    await Promise.race([
      _firstTokenReady,
      new Promise<void>((r) => setTimeout(r, 5000)),
    ]);
  }

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

  // On 401, try refreshing the token once and retry
  if (res.status === 401 && _getTokenFn) {
    const freshToken = await _getTokenFn();
    if (freshToken && freshToken !== _authToken) {
      _authToken = freshToken;
      headers['Authorization'] = `Bearer ${freshToken}`;
      const retry = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          ...headers,
          ...init?.headers,
        },
      });
      if (!retry.ok) {
        const body = await retry.text();
        throw ApiError.parse(retry.status, body);
      }
      if (retry.status === 204) return undefined as T;
      return retry.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw ApiError.parse(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
