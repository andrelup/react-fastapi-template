import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useItems } from './useItems';

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
  items: [
    {
      id: 1,
      name: 'Cámara analógica',
      slug: 'camara-analogica',
      description: null,
      category: 'electronica',
      tags: [],
      owner_id: 7,
      version: 1,
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

describe('useItems', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the plain listing when there is no search text', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { result } = renderHook(() => useItems({ page: 1 }));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(apiClient.get).toHaveBeenCalledWith('/items?page=1&page_size=20');
  });

  it('fetches the search endpoint once a search term is given', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawPage);

    const { result } = renderHook(() => useItems({ page: 1, search: 'cámara' }));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(apiClient.get).toHaveBeenCalledWith('/items/search?q=c%C3%A1mara&page=1&page_size=20');
  });

  it('exposes the error message when the request fails', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const { ApiError } = await import('@/types/api');
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError('Server error', 500));

    const { result } = renderHook(() => useItems({ page: 1 }));

    await waitFor(() => expect(result.current.error).toBe('Server error'));
  });
});
