/**
 * Global API types shared across all features.
 * Mirrors the backend envelope defined in
 * `backend/src/adapters/inbound/schemas/common.py`.
 */

/** Standard API response envelope returned by every backend endpoint. */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/** Paginated collection returned by list endpoints. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Error thrown by the API client when a request fails or the backend
 * returns `success: false`. */
export class ApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
