import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useApi } from '@/hooks/useApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { setAuthToken } from '@/lib/api-client';
import { getCurrentUser, loginUser } from '../api/auth-api';
import { AuthContext } from '../context/auth-context';
import type { AuthToken, LoginCredentials, User } from '../types';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides the authentication state (current user + token) to the whole
 * app via React Context. The token is persisted to `localStorage` and
 * synced with the API client so every request carries the auth header.
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setToken, removeToken] = useLocalStorage<string | null>('auth-token', null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { execute: fetchCurrentUser } = useApi(getCurrentUser);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthToken> => {
      setIsLoading(true);
      try {
        const authToken = await loginUser(credentials);
        setToken(authToken.accessToken);
        setUser(authToken.user);
        return authToken;
      } finally {
        setIsLoading(false);
      }
    },
    [setToken],
  );

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, [removeToken]);

  // Rehydrate the user on mount (e.g. after a page refresh): the token
  // survives in localStorage but `user` is plain component state and is
  // lost, so `ProtectedRoute` (gated on `token`) would keep the session
  // "open" while any UI relying on `user` (e.g. the Sidebar) stays blank.
  useEffect(() => {
    if (!token || user) {
      return;
    }

    void (async () => {
      const currentUser = await fetchCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Token is invalid or expired — clear the session so
        // `ProtectedRoute` redirects to `/login`.
        logout();
      }
    })();
  }, [token, user, fetchCurrentUser, logout]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
