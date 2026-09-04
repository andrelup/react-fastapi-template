import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/types/api';
import { useApi } from './useApi';

describe('useApi', () => {
  it('starts idle with no data and no error', () => {
    const { result } = renderHook(() => useApi(vi.fn()));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes the result of a successful request', async () => {
    const requestFn = vi.fn().mockResolvedValue({ id: 1, title: 'Some book' });

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute();
    });

    await waitFor(() => expect(result.current.data).toEqual({ id: 1, title: 'Some book' }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes the ApiError message when the request fails', async () => {
    const requestFn = vi.fn().mockRejectedValue(new ApiError('Invalid credentials', 401));

    const { result } = renderHook(() => useApi(requestFn));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.execute();
    });

    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).toBe('Invalid credentials'));
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to a generic message for unknown errors', async () => {
    const requestFn = vi.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute();
    });

    await waitFor(() => expect(result.current.error).toBe('Unexpected error'));
  });

  it('forwards the arguments to the request function', async () => {
    const requestFn = vi.fn().mockResolvedValue('ok');

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute('a@example.com', 'secret');
    });

    expect(requestFn).toHaveBeenCalledWith('a@example.com', 'secret');
  });
});
