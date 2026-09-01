import { useApi } from '@/hooks/useApi';
import { useAuth } from './useAuth';

/** Wraps the auth context's `login` in the generic `useApi` state machine. */
export const useLogin = () => {
  const { login } = useAuth();
  return useApi(login);
};
