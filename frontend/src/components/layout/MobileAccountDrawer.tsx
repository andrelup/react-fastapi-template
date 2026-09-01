import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the drawer reads it directly via `useAuth()`.
import { useAuth } from '@/features/auth';
import { Avatar } from '@/components/ui/Avatar';

const CloseIcon = () => (
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
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const DashboardIcon = () => (
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
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const HeartIcon = () => (
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
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
);

const OrdersIcon = () => (
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
    <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

const ProfileIcon = () => (
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

const MessagesIcon = () => (
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
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a8.38 8.38 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    className="h-[18px] w-[18px]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

interface DrawerItemProps {
  icon: ReactNode;
  label: string;
  /** When set, the item is shown as an upcoming (disabled) feature with this pill text. */
  soon?: string;
}

// Visual-only item: no route exists yet for these secondary sections, so they
// are not wrapped in a `NavLink`. Turn each into a real `NavLink` once its
// route exists (keeping the trailing chevron as the affordance).
const DrawerItem = ({ icon, label, soon }: DrawerItemProps) => (
  <button
    type="button"
    disabled={soon !== undefined}
    className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] text-ink hover:bg-bg disabled:cursor-default disabled:text-body disabled:hover:bg-transparent"
  >
    <span className="text-body">{icon}</span>
    <span className="flex-1">{label}</span>
    {soon !== undefined ? (
      <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
        {soon}
      </span>
    ) : (
      <span className="text-muted">
        <ChevronRightIcon />
      </span>
    )}
  </button>
);

interface DrawerLinkProps {
  icon: ReactNode;
  label: string;
  to: string;
  /** Closes the drawer, so the destination screen is not left behind the overlay. */
  onNavigate: () => void;
}

// Navigable counterpart of `DrawerItem`, for the entries that already have a
// route. Mirrors the desktop `Sidebar` active styling.
const DrawerLink = ({ icon, label, to, onNavigate }: DrawerLinkProps) => (
  <NavLink
    to={to}
    onClick={onNavigate}
    className={({ isActive }) =>
      `flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] ${
        isActive ? 'bg-primary-50 font-semibold text-primary-dark' : 'text-ink hover:bg-bg'
      }`
    }
  >
    <span className="text-body">{icon}</span>
    <span className="flex-1">{label}</span>
    <span className="text-muted">
      <ChevronRightIcon />
    </span>
  </NavLink>
);

export interface MobileAccountDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile-only slide-in "Cuenta" panel opened from the `MobileTabBar` account
 * tab. Surfaces the secondary navigation and the logout action that, on
 * desktop, live in the full `Sidebar`. Role-aware: sellers see profile and
 * messages, customers see favourites, orders and profile (design system
 * section 10).
 */
export const MobileAccountDrawer = ({ open, onClose }: MobileAccountDrawerProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!open || !user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Cuenta">
      <button
        type="button"
        aria-label="Cerrar menú de cuenta"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="absolute inset-y-0 right-0 flex w-[86%] max-w-[360px] flex-col bg-surface shadow-float">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Cuenta</span>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-bg text-body hover:bg-border"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-4">
          <div className="flex items-center gap-3 rounded-md bg-primary-50 p-3">
            <Avatar name={user.name} size="md" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[13px] text-muted">{user.email}</p>
            </div>
          </div>
        </div>

        <nav aria-label="Cuenta" className="flex-1 overflow-auto px-4 py-3">
          {user.role === 'seller' ? (
            <>
              {/*
                The bottom tab bar has no room for the dashboard (Inicio + FAB
                + Cuenta), so this is its only mobile entry point. Seller-only:
                customers would get a 404 from `RoleRoute`.
              */}
              <DrawerLink
                icon={<DashboardIcon />}
                label="Dashboard"
                to="/dashboard"
                onNavigate={onClose}
              />
              <DrawerItem icon={<ProfileIcon />} label="Editar perfil" />
              <DrawerItem icon={<MessagesIcon />} label="Mensajes" soon="Próximamente" />
            </>
          ) : (
            <>
              <DrawerItem icon={<HeartIcon />} label="Mis favoritos" />
              <DrawerItem icon={<OrdersIcon />} label="Mis pedidos" />
              <DrawerItem icon={<ProfileIcon />} label="Editar perfil" />
            </>
          )}
        </nav>

        <div className="border-t border-border p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded border border-danger-border bg-transparent py-2.5 font-semibold text-danger hover:bg-danger-bg"
          >
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};
