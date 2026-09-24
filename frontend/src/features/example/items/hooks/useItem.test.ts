import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useItem } from './useItem';

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

const rawItemDetail = {
  id: 1,
  name: 'Cámara analógica',
  slug: 'camara-analogica',
  description: null,
  category: 'electronica',
  tags: [],
  owner_id: 7,
  version: 1,
  collections: [{ id: 1, name: 'Clásicos' }],
};

describe('useItem', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the item by id on mount', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawItemDetail);

    const { result } = renderHook(() => useItem(1));

    await waitFor(() => expect(result.current.data?.name).toBe('Cámara analógica'));
    expect(apiClient.get).toHaveBeenCalledWith('/items/1');
    expect(result.current.data?.collections).toEqual([{ id: 1, name: 'Clásicos' }]);
  });

  it('exposes the status of a failed request', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const { ApiError } = await import('@/types/api');
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError('Item not found', 404));

    const { result } = renderHook(() => useItem(999));

    await waitFor(() => expect(result.current.status).toBe(404));
  });

  it('refetches when the id changes', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawItemDetail);

    const { result, rerender } = renderHook(({ id }) => useItem(id), { initialProps: { id: 1 } });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...rawItemDetail, id: 2, name: 'Otro' });
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data?.name).toBe('Otro'));
    expect(apiClient.get).toHaveBeenCalledWith('/items/2');
  });
});
