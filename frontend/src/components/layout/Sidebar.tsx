import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `ProtectedRoute` already
// relies on), so the Sidebar reads it directly via `useAuth()` instead of
// receiving `user`/`onLogout` as props.
import { useAuth } from '@/features/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { SoonPill } from '@/components/layout/SoonPill';
import { useCatalogNavState } from '@/components/layout/useCatalogNavState';

export interface SidebarProps {
  className?: string;
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'block rounded px-3 py-2 text-sm',
    isActive ? 'bg-primary-50 font-semibold text-primary-dark' : 'text-body hover:bg-bg',
  );

// Visual-only item: no page exists yet for it, so it is not wrapped in a
// `NavLink`. Turn it into a real `NavLink` once its route exists.
const InactiveNavItem = ({ label }: { label: string }) => (
  <div
    aria-disabled="true"
    className="flex items-center justify-between rounded px-3 py-2 text-sm text-body"
  >
    <span>{label}</span>
    <SoonPill />
  </div>
);

const NavGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mb-4">
    <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
    {children}
  </div>
);

/** Left sidebar shown for logged-in users: profile, grouped navigation, and logout. */
export const Sidebar = ({ className }: SidebarProps) => {
  const { user, logout } = useAuth();
  const { catalogActive, mineActive } = useCatalogNavState();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    // From `md` the sidebar is pinned under the sticky header and is exactly as
    // tall as the rest of the window, so its nav scrolls internally and the
    // logout button never leaves the screen.
    <aside
      className={cn(
        'flex w-[248px] flex-col border-r border-border bg-surface',
        'md:sticky md:top-[62px] md:h-[calc(100dvh-62px)] md:self-start',
        className,
      )}
    >
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
          {/* `Link`, not `NavLink`: it would also mark "Mis items" active (same path). */}
          <Link
            to="/items"
            aria-current={catalogActive ? 'page' : undefined}
            className={navLinkClassName({ isActive: catalogActive })}
          >
            Explorar catálogo
          </Link>
        </NavGroup>

        <NavGroup label="Colecciones">
          <NavLink to="/colecciones" className={navLinkClassName}>
            Ver colecciones
          </NavLink>
          <InactiveNavItem label="Colecciones destacadas" />
        </NavGroup>

        <NavGroup label="Cuenta">
          <Link
            to="/items?mine=true"
            aria-current={mineActive ? 'page' : undefined}
            className={navLinkClassName({ isActive: mineActive })}
          >
            Mis items
          </Link>
          <InactiveNavItem label="Mensajes" />
          <InactiveNavItem label="Ajustes" />
        </NavGroup>

        <NavGroup label="Desarrollo">
          <NavLink to="/components-ui" className={navLinkClassName}>
            Componentes UI
          </NavLink>
        </NavGroup>
      </nav>

      <div className="mt-auto border-t border-border p-4">
        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
};
