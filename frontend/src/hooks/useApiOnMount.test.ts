import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiOnMount } from './useApiOnMount';

describe('useApiOnMount', () => {
  it('fires the request once on mount', async () => {
    const requestFn = vi.fn().mockResolvedValue({ id: 1, name: 'Some item' });

    const { result } = renderHook(() => useApiOnMount(requestFn, [1]));

    await waitFor(() => expect(result.current.data).toEqual({ id: 1, name: 'Some item' }));
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(requestFn).toHaveBeenCalledWith(1);
  });

  it('does not fetch when enabled is false', () => {
    const requestFn = vi.fn().mockResolvedValue(null);

    renderHook(() => useApiOnMount(requestFn, [1], { enabled: false }));

    expect(requestFn).not.toHaveBeenCalled();
  });

  it('does not refetch when a new args array with the same values is passed on rerender', async () => {
    const requestFn = vi.fn().mockResolvedValue('ok');

    const { rerender } = renderHook(({ id }) => useApiOnMount(requestFn, [id]), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(requestFn).toHaveBeenCalledTimes(1));

    // A brand new array literal with the same value — the exact shape a
    // caller writing `useApiOnMount(getItem, [id])` produces on every render.
    rerender({ id: 1 });
    rerender({ id: 1 });

    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it('refetches when the args actually change', async () => {
    const requestFn = vi.fn().mockResolvedValue('ok');

    const { rerender } = renderHook(({ id }) => useApiOnMount(requestFn, [id]), {
      initialProps: { id: 1 },
    });

    await waitFor(() => expect(requestFn).toHaveBeenCalledTimes(1));

    rerender({ id: 2 });

    await waitFor(() => expect(requestFn).toHaveBeenCalledTimes(2));
    expect(requestFn).toHaveBeenLastCalledWith(2);
  });

  it('exposes a refetch that calls the request function again with the current args', async () => {
    const requestFn = vi.fn().mockResolvedValue('ok');

    const { result } = renderHook(() => useApiOnMount(requestFn, [1]));

    await waitFor(() => expect(requestFn).toHaveBeenCalledTimes(1));

    await result.current.refetch();

    expect(requestFn).toHaveBeenCalledTimes(2);
  });
});
