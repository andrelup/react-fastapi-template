import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/auth-context';

/** Consumes the auth context. Throws if used outside `AuthProvider`. */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
