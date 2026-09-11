import { useCallback, useEffect, useRef } from 'react';
import { useApi } from '@/hooks/useApi';

interface UseApiOnMountOptions {
  /** Skip the automatic fetch — e.g. while a required id is not known yet. Defaults to `true`. */
  enabled?: boolean;
}

/**
 * Wraps `useApi` and fires `execute` for you on mount, instead of leaving
 * every screen to decide between a bare `useEffect` and a manual first call.
 *
 * `args` is compared by its serialised contents, not by reference, so
 * passing a fresh array or object literal on every render — the common case,
 * `useApiOnMount(getItems, [filters])` — does not retrigger the fetch; only
 * an actual change in one of its values does. That makes `args` JSON-safe
 * values only (ids, strings, plain filter objects) — no functions, no
 * `Date`, no class instances.
 *
 * @example
 * const { data, isLoading, error, refetch } = useApiOnMount(getItems, [filters]);
 */
export const useApiOnMount = <TArgs extends unknown[], TResult>(
  requestFn: (...args: TArgs) => Promise<TResult>,
  args: TArgs,
  { enabled = true }: UseApiOnMountOptions = {},
) => {
  const { data, isLoading, error, execute } = useApi(requestFn);

  // Refs so the effect below can always call the latest `execute`/`args`
  // without needing either in its dependency array — that is what keeps an
  // unstable `args` array from causing a refetch loop.
  const executeRef = useRef(execute);
  executeRef.current = execute;

  const argsRef = useRef(args);
  argsRef.current = args;

  const argsKey = JSON.stringify(args);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void executeRef.current(...argsRef.current);
  }, [enabled, argsKey]);

  const refetch = useCallback(() => executeRef.current(...argsRef.current), []);

  return { data, isLoading, error, refetch };
};
