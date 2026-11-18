import { useState } from 'react';
import { Home, Store, User } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the tab bar reads it directly via `useAuth()` instead of
// receiving `user` as a prop.
import { useAuth } from '@/features/auth';
import { MobileAccountDrawer } from '@/components/layout/MobileAccountDrawer';
import { useCatalogNavState } from '@/components/layout/useCatalogNavState';
import { cn } from '@/lib/utils';

const tabClassName = (isActive: boolean) =>
  cn(
    'flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px]',
    isActive ? 'text-primary-dark font-bold' : 'text-muted',
  );

const navLinkClassName = ({ isActive }: { isActive: boolean }) => tabClassName(isActive);

interface AccountTabProps {
  open: boolean;
  onClick: () => void;
}

// Opens the `MobileAccountDrawer` rather than navigating: the "Cuenta" section
// is a mobile-only menu of the secondary options that live in the desktop
// `Sidebar`.
const AccountTab = ({ open, onClick }: AccountTabProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-haspopup="dialog"
    aria-expanded={open}
    className={tabClassName(open)}
  >
    <User className="h-5 w-5" aria-hidden="true" />
    <span>Cuenta</span>
  </button>
);

const barClassName =
  'md:hidden fixed inset-x-0 bottom-0 z-40 h-16 bg-surface border-t border-border';

/**
 * Bottom tab bar shown on mobile (`max-width: 768px`) instead of the
 * `Sidebar`: the two primary destinations, Inicio and Catálogo, plus a Cuenta
 * tab that opens the `MobileAccountDrawer` with everything else the `Sidebar`
 * offers (Mis items, Colecciones, Desarrollo, logout). The mobile navigation
 * must reach every section the `Sidebar` does; `navigation-parity.test.tsx`
 * enforces it.
 */
export const MobileTabBar = () => {
  const { user } = useAuth();
  const { catalogActive } = useCatalogNavState();
  const [accountOpen, setAccountOpen] = useState(false);

  // Avoid a flash of the tab bar before the session is known.
  if (!user) {
    return null;
  }

  const toggleAccount = () => setAccountOpen((prev) => !prev);

  return (
    <>
      <nav aria-label="Navegación móvil" className={barClassName}>
        <div className="flex h-full items-stretch">
          <NavLink to="/" end className={navLinkClassName}>
            <Home className="h-5 w-5" aria-hidden="true" />
            <span>Inicio</span>
          </NavLink>
          {/* `Link`, not `NavLink`: it must not light up on the "Mis items" view. */}
          <Link
            to="/items"
            aria-current={catalogActive ? 'page' : undefined}
            className={tabClassName(catalogActive)}
          >
            <Store className="h-5 w-5" aria-hidden="true" />
            <span>Catálogo</span>
          </Link>
          <AccountTab open={accountOpen} onClick={toggleAccount} />
        </div>
      </nav>
      <MobileAccountDrawer open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
};
