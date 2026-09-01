import { useCallback, useState } from 'react';
import { ApiError } from '@/types/api';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Generic hook to wrap async API calls (typically `apiClient` calls) with
 * loading/error/data state. It never touches the network itself — the
 * caller passes the request function.
 *
 * @example
 * const { data, isLoading, error, execute } = useApi(loginUser);
 * await execute(credentials);
 */
export const useApi = <TArgs extends unknown[], TResult>(
  requestFn: (...args: TArgs) => Promise<TResult>,
) => {
  const [state, setState] = useState<UseApiState<TResult>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setState({ data: null, isLoading: true, error: null });
      try {
        const result = await requestFn(...args);
        setState({ data: result, isLoading: false, error: null });
        return result;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Unexpected error';
        setState({ data: null, isLoading: false, error: message });
        return null;
      }
    },
    [requestFn],
  );

  return { ...state, execute };
};
