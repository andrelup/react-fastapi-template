import { createContext } from 'react';
import type { AuthToken, LoginCredentials, User } from '../types';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthToken>;
  logout: () => void;
}

/**
 * Private auth context. Not exported from the feature's public API —
 * only `AuthProvider` and `useAuth` (which wrap it) are.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
