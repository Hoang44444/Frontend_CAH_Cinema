import type { ApiResponse } from '@/api/types';

/**
 * Empty base URL means "use the Vite dev proxy", which forwards /api to the
 * Spring Boot app on :8080.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const ACCESS_KEY = 'cah.accessToken';
const REFRESH_KEY = 'cah.refreshToken';
const USER_KEY = 'cah.user';

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  rawUser: () => localStorage.getItem(USER_KEY),
  set(access: string, refresh: string, user: unknown) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  setUser(user: unknown) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/** Raised for every non-2xx response so callers can branch on the backend code. */
export class ApiError extends Error {
  readonly status: number;
  /** Backend ErrorCode string, e.g. QUOTE_EXPIRED_OR_CHANGED. */
  readonly code: string | null;
  readonly body: unknown;

  constructor(status: number, message: string, code: string | null, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Fired when a refresh attempt fails, so the auth store can drop the session. */
export const AUTH_EXPIRED_EVENT = 'cah:auth-expired';

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Attach the bearer token even on endpoints that also work anonymously. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Set for endpoints that return the DTO directly instead of ApiResponse. */
  raw?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function extractMessage(body: unknown, status: number): { message: string; code: string | null } {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const message =
      (typeof b.message === 'string' && b.message) ||
      (typeof b.error === 'string' && b.error) ||
      `Yêu cầu thất bại (HTTP ${status})`;
    const code =
      (typeof b.errorCode === 'string' && b.errorCode) ||
      (typeof b.code === 'string' && b.code) ||
      null;
    return { message, code };
  }
  return { message: `Yêu cầu thất bại (HTTP ${status})`, code: null };
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Single-flight refresh so a burst of 401s only triggers one /auth/refresh. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(buildUrl('/api/v1/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await readBody(res)) as ApiResponse<{
        accessToken: string;
        refreshToken: string;
        user: unknown;
      }> | null;
      const data = body?.data;
      if (!data?.accessToken) return false;
      tokenStore.set(data.accessToken, data.refreshToken ?? refreshToken, data.user ?? null);
      return true;
    } catch {
      return false;
    } finally {
      // Let the next 401 start a fresh attempt.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

async function send(path: string, options: RequestOptions, isRetry: boolean): Promise<unknown> {
  const { method = 'GET', body, query, auth = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = tokenStore.access();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (res.status === 401 && !isRetry && tokenStore.refresh()) {
    if (await refreshAccessToken()) return send(path, options, true);
    tokenStore.clear();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  const payload = await readBody(res);

  if (!res.ok) {
    const { message, code } = extractMessage(payload, res.status);
    throw new ApiError(res.status, message, code, payload);
  }

  return payload;
}

/** Calls an endpoint wrapped in ApiResponse and returns `data`. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await send(path, options, false);
  if (options.raw) return payload as T;
  if (payload && typeof payload === 'object' && 'data' in (payload as object)) {
    return (payload as ApiResponse<T>).data;
  }
  // Some admin endpoints (promotions) return the DTO directly.
  return payload as T;
}

/** Calls an endpoint that returns its DTO directly, with no ApiResponse wrapper. */
export function requestRaw<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, raw: true });
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE', body }),
};
