import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { Spinner } from '@/components/ui/Spinner';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface RoleGateProps {
  allow: UserRole[];
  children: ReactNode;
}

const RoleGate = ({ allow, children }: RoleGateProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // After a refresh the token is restored from `localStorage` before the user
  // is re-fetched, so `user` is briefly null for an allowed role too. Without
  // this the 404 would flash before the real content.
  if (!user) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!allow.includes(user.role)) {
    return (
      <div className="flex items-center justify-center py-12">
        <NotFoundState onGoHome={() => navigate('/')} />
      </div>
    );
  }

  return <>{children}</>;
};

interface RoleRouteProps {
  /** Roles allowed to see the route. Any other role gets the 404 screen. */
  allow: UserRole[];
  children: ReactNode;
}

/**
 * Route guard for sections restricted to certain roles. Wraps
 * `ProtectedRoute`, so an anonymous visitor is still redirected to `/login`;
 * an authenticated user whose role is not in `allow` gets the same "página no
 * encontrada" screen as an unknown route, instead of being told about a
 * section their account cannot use.
 *
 * This is UI-level gating only — the real enforcement belongs to the API.
 */
export const RoleRoute = ({ allow, children }: RoleRouteProps) => (
  <ProtectedRoute>
    <RoleGate allow={allow}>{children}</RoleGate>
  </ProtectedRoute>
);
