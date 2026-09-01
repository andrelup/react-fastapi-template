import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the tab bar reads it directly via `useAuth()` instead of
// receiving `user` as a prop.
import { useAuth } from '@/features/auth';
import { MobileAccountDrawer } from '@/components/layout/MobileAccountDrawer';

const HomeIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </svg>
);

const CartTabIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="9" cy="20" r="1.3" />
    <circle cx="17" cy="20" r="1.3" />
    <path d="M2 3h3l2.3 12.1a1.5 1.5 0 0 0 1.5 1.2h8a1.5 1.5 0 0 0 1.5-1.2L22 7H6" />
  </svg>
);

const AccountIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
);

const PlusIcon = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth={2.3}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const tabClassName = (isActive: boolean) =>
  `flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px] ${
    isActive ? 'text-primary-dark font-bold' : 'text-muted'
  }`;

const navLinkClassName = ({ isActive }: { isActive: boolean }) => tabClassName(isActive);

interface CartTabProps {
  badge?: number;
}

// Visual-only tab: the cart page does not exist yet, so it is not wrapped in a
// `NavLink`. Turn it into a real `NavLink` once its route exists.
const CartTab = ({ badge }: CartTabProps) => (
  <div className={tabClassName(false)}>
    <span className="relative">
      <CartTabIcon />
      {badge !== undefined && (
        <span className="absolute -right-2 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-surface bg-primary text-[8px] font-bold text-white">
          {badge}
        </span>
      )}
    </span>
    <span>Carrito</span>
  </div>
);

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
    <AccountIcon />
    <span>Cuenta</span>
  </button>
);

const barClassName =
  'md:hidden fixed inset-x-0 bottom-0 z-40 h-16 bg-surface border-t border-border';

interface RoleBarProps {
  accountOpen: boolean;
  onAccountToggle: () => void;
}

const SellerTabBar = ({ accountOpen, onAccountToggle }: RoleBarProps) => (
  <nav aria-label="Navegación móvil" className={barClassName}>
    <div className="grid h-full grid-cols-[1fr_64px_1fr] items-stretch">
      <div className="flex items-stretch justify-center">
        <NavLink to="/" end className={navLinkClassName}>
          <HomeIcon />
          <span>Inicio</span>
        </NavLink>
      </div>

      <div />

      <div className="flex items-stretch justify-center">
        <AccountTab open={accountOpen} onClick={onAccountToggle} />
      </div>
    </div>

    <button
      type="button"
      // TODO: open "Publicar libro"
      className="absolute bottom-[23px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-[5px]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-bg bg-primary shadow-float">
        <PlusIcon />
      </span>
      <span className="text-[8.5px] font-semibold text-primary-dark">Añadir libro</span>
    </button>
  </nav>
);

const CustomerTabBar = ({ accountOpen, onAccountToggle }: RoleBarProps) => (
  <nav aria-label="Navegación móvil" className={barClassName}>
    <div className="flex h-full items-stretch">
      <NavLink to="/" end className={navLinkClassName}>
        <HomeIcon />
        <span>Inicio</span>
      </NavLink>
      {/* TODO: connect to real cart count when the cart feature exists */}
      <CartTab badge={3} />
      <AccountTab open={accountOpen} onClick={onAccountToggle} />
    </div>
  </nav>
);

/**
 * Bottom tab bar shown on mobile (`max-width: 768px`) instead of the
 * `Sidebar`. Simplified, role-aware navigation (design system section 10):
 * sellers get Inicio + a central "Añadir libro" FAB + Cuenta; customers get
 * Inicio + Carrito + Cuenta. The "Cuenta" tab opens the
 * `MobileAccountDrawer` with the remaining secondary options.
 */
export const MobileTabBar = () => {
  const { user } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  // Avoid a flash of the wrong variant before the role is known.
  if (!user) {
    return null;
  }

  const toggleAccount = () => setAccountOpen((prev) => !prev);
  const Bar: (props: RoleBarProps) => ReactNode =
    user.role === 'seller' ? SellerTabBar : CustomerTabBar;

  return (
    <>
      <Bar accountOpen={accountOpen} onAccountToggle={toggleAccount} />
      <MobileAccountDrawer open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
};
