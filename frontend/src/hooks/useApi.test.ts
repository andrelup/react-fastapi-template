import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/types/api';
import { useApi } from './useApi';

describe('useApi', () => {
  it('starts idle with no data, no error and no status', () => {
    const { result } = renderHook(() => useApi(vi.fn()));

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBeNull();
  });

  it('exposes the result of a successful request', async () => {
    const requestFn = vi.fn().mockResolvedValue({ id: 1, name: 'Some item' });

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute();
    });

    await waitFor(() => expect(result.current.data).toEqual({ id: 1, name: 'Some item' }));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBeNull();
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

  it('exposes the ApiError status so a screen can tell a 404 from a 500', async () => {
    const requestFn = vi.fn().mockRejectedValue(new ApiError('Item not found', 404));

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute();
    });

    await waitFor(() => expect(result.current.status).toBe(404));
  });

  it('resets the status to null on a new request', async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Item not found', 404))
      .mockResolvedValueOnce({ id: 1, name: 'Some item' });

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute();
    });
    await waitFor(() => expect(result.current.status).toBe(404));

    await act(async () => {
      await result.current.execute();
    });
    await waitFor(() => expect(result.current.status).toBeNull());
  });

  it('falls back to a generic message and a null status for unknown errors', async () => {
    const requestFn = vi.fn().mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useApi(requestFn));

    await act(async () => {
      await result.current.execute();
    });

    await waitFor(() => expect(result.current.error).toBe('Unexpected error'));
    expect(result.current.status).toBeNull();
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
