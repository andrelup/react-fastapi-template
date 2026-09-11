import { createContext } from 'react';
import type { AuthToken, LoginCredentials, User, UserRole } from '../types';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthToken>;
  logout: () => void;
  /**
   * Rank-based hierarchy check, mirrors the backend's `has_role(user, minimum)`:
   * ADMIN(2) > EDITOR(1) > VIEWER(0). True when the current user's rank is at
   * or above `minimum` — an ADMIN satisfies `hasRole('viewer')`. A null user
   * (not yet rehydrated, or logged out) returns `false`.
   */
  hasRole: (minimum: UserRole) => boolean;
}

/**
 * Private auth context. Not exported from the feature's public API —
 * only `AuthProvider` and `useAuth` (which wrap it) are.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
