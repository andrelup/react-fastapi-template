import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCollections } from './useCollections';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAuthToken: vi.fn(),
}));

const rawPage = {
  items: [{ id: 1, name: 'Clásicos', description: null, version: 1 }],
  total: 1,
  page: 1,
  page_size: 20,
};

describe('useCollections', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the requested page on mount', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { result } = renderHook(() => useCollections({ page: 1 }));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(apiClient.get).toHaveBeenCalledWith('/collections?page=1&page_size=20');
  });

  it('exposes the error message when the request fails', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const { ApiError } = await import('@/types/api');
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError('Server error', 500));

    const { result } = renderHook(() => useCollections({ page: 1 }));

    await waitFor(() => expect(result.current.error).toBe('Server error'));
  });
});
