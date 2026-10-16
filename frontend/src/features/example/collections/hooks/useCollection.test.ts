import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCollection } from './useCollection';

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

const rawDetail = {
  id: 1,
  name: 'Clásicos',
  description: null,
  version: 1,
  items: [{ id: 5, name: 'Cámara analógica' }],
};

describe('useCollection', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the collection by id on mount', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawDetail);

    const { result } = renderHook(() => useCollection(1));

    await waitFor(() => expect(result.current.data?.name).toBe('Clásicos'));
    expect(apiClient.get).toHaveBeenCalledWith('/collections/1');
    expect(result.current.data?.items).toEqual([{ id: 5, name: 'Cámara analógica' }]);
  });

  it('exposes the status of a failed request', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const { ApiError } = await import('@/types/api');
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError('Collection not found', 404));

    const { result } = renderHook(() => useCollection(999));

    await waitFor(() => expect(result.current.status).toBe(404));
  });

  it('refetches when the id changes', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.get).mockResolvedValueOnce(rawDetail);

    const { result, rerender } = renderHook(({ id }) => useCollection(id), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));

    vi.mocked(apiClient.get).mockResolvedValueOnce({ ...rawDetail, id: 2, name: 'Otra' });
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data?.name).toBe('Otra'));
    expect(apiClient.get).toHaveBeenCalledWith('/collections/2');
  });
});
