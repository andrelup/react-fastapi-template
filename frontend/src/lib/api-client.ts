import type { ApiResponse } from '@/types/api';
import { ApiError } from '@/types/api';

const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

let authToken: string | null = null;

/**
 * Sets (or clears) the bearer token used for authenticated requests.
 * Called by `AuthProvider` in a `useEffect` whenever the token changes,
 * avoiding a circular import between `lib/` and `app/providers.tsx`.
 */
export const setAuthToken = (token: string | null): void => {
  authToken = token;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

const isApiResponse = (value: unknown): value is ApiResponse<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  'data' in value &&
  'error' in value;

/**
 * Generic typed request wrapper around `fetch`. Unwraps the backend's
 * `ApiResponse<T>` envelope and throws `ApiError` on failure.
 * This is the ONLY place in the app allowed to call `fetch` directly.
 */
export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error: unable to reach the server');
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!isApiResponse(payload)) {
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status);
    }
    throw new ApiError('Unexpected response format from the server', response.status);
  }

  if (!response.ok || !payload.success) {
    throw new ApiError(payload.error ?? `Request failed with status ${response.status}`, response.status);
  }

  return payload.data as T;
};

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PUT', body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body, headers }),
  delete: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'DELETE', headers }),
};
