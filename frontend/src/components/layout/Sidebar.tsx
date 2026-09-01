import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `ProtectedRoute` already
// relies on), so the Sidebar reads it directly via `useAuth()` instead of
// receiving `user`/`onLogout` as props.
import { useAuth } from '@/features/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

export interface SidebarProps {
  className?: string;
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm ${
    isActive ? 'bg-primary-50 font-semibold text-primary-dark' : 'text-body hover:bg-bg'
  }`;

// Visual-only item: no page exists yet for it, so it is not wrapped in a
// `NavLink`. Turn it into a real `NavLink` once its route exists.
const InactiveNavItem = ({
  label,
  badge,
}: {
  label: string;
  badge?: number;
}) => (
  <div className="flex items-center justify-between rounded px-3 py-2 text-sm text-body">
    <span>{label}</span>
    {badge !== undefined && <Badge>{badge}</Badge>}
  </div>
);

const NavGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mb-4">
    <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
    {children}
  </div>
);

/** Left sidebar shown for logged-in users: profile, grouped navigation, and logout. */
export const Sidebar = ({ className = '' }: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className={`flex w-[248px] flex-col border-r border-border bg-surface ${className}`}>
      <div className="border-b border-border p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[13px] text-muted">{user.email}</p>
            </div>
          </div>
        ) : (
          <Spinner />
        )}
      </div>

      <nav className="flex-1 overflow-auto p-4">
        <NavGroup label="Principal">
          <NavLink to="/" end className={navLinkClassName}>
            Inicio
          </NavLink>
          {/* Seller-only route: hidden for customers, who would get a 404. */}
          {user?.role === 'seller' && (
            <NavLink to="/dashboard" className={navLinkClassName}>
              Dashboard
            </NavLink>
          )}
          <InactiveNavItem label="Explorar catálogo" />
        </NavGroup>

        <NavGroup label="Vender">
          <InactiveNavItem label="Publicar libro" />
          <InactiveNavItem label="Mis libros" />
          <InactiveNavItem label="Ventas y pedidos" badge={2} />
        </NavGroup>

        <NavGroup label="Cuenta">
          <InactiveNavItem label="Favoritos" />
          <InactiveNavItem label="Mensajes" badge={1} />
          <InactiveNavItem label="Ajustes" />
        </NavGroup>

        <NavGroup label="Desarrollo">
          <NavLink to="/componentes-ui" className={navLinkClassName}>
            Componentes UI
          </NavLink>
        </NavGroup>
      </nav>

      <div className="mt-auto border-t border-border p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded border border-danger-border bg-transparent py-2.5 font-semibold text-danger hover:bg-danger-bg"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};
