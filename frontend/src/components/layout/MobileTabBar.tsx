import { useState } from 'react';
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

const tabClassName = (isActive: boolean) =>
  `flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px] ${
    isActive ? 'text-primary-dark font-bold' : 'text-muted'
  }`;

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
    <AccountIcon />
    <span>Cuenta</span>
  </button>
);

const barClassName =
  'md:hidden fixed inset-x-0 bottom-0 z-40 h-16 bg-surface border-t border-border';

/**
 * Bottom tab bar shown on mobile (`max-width: 768px`) instead of the
 * `Sidebar`. Simplified navigation (design system section 10): Inicio +
 * Cuenta. The "Cuenta" tab opens the `MobileAccountDrawer` with the
 * remaining secondary options.
 */
export const MobileTabBar = () => {
  const { user } = useAuth();
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
            <HomeIcon />
            <span>Inicio</span>
          </NavLink>
          <AccountTab open={accountOpen} onClick={toggleAccount} />
        </div>
      </nav>
      <MobileAccountDrawer open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
};
