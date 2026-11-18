import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the tab bar reads it directly via `useAuth()` instead of
// receiving `user` as a prop.
import { useAuth } from '@/features/auth';
import { MobileAccountDrawer } from '@/components/layout/MobileAccountDrawer';
import { TAB_ENTRIES } from '@/components/layout/navigation';
import { useNavEntryActive } from '@/components/layout/useNavEntryActive';
import { cn } from '@/lib/utils';

const tabClassName = (isActive: boolean) =>
  cn(
    'flex flex-1 flex-col items-center justify-center gap-[3px] text-[10px]',
    isActive ? 'text-primary-dark font-bold' : 'text-muted',
  );

interface AccountTabProps {
  buttonRef: RefObject<HTMLButtonElement>;
  open: boolean;
  onClick: () => void;
}

// Opens the `MobileAccountDrawer` rather than navigating: the "Cuenta" section
// is a mobile-only menu of the secondary options that live in the desktop
// `Sidebar`.
const AccountTab = ({ buttonRef, open, onClick }: AccountTabProps) => (
  <button
    ref={buttonRef}
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
 * `Sidebar`. The tabs that navigate (Inicio, Catálogo) come from the
 * navigation config (`TAB_ENTRIES`); the Cuenta tab opens the
 * `MobileAccountDrawer` with everything else the `Sidebar` offers. The mobile
 * navigation must reach every section the `Sidebar` does;
 * `navigation-parity.test.tsx` enforces it.
 */
export const MobileTabBar = () => {
  const { user } = useAuth();
  const isActive = useNavEntryActive();
  const location = useLocation();
  const [accountOpen, setAccountOpen] = useState(false);
  const [seenLocationKey, setSeenLocationKey] = useState(location.key);
  const accountTabRef = useRef<HTMLButtonElement>(null);

  // Browser Back/Forward changes the page without a click on the panel, so the
  // panel closes whenever the location does. Adjusting state while rendering
  // (instead of an effect that copies the location into state) re-renders
  // before anything is committed: no extra commit, no frame with a stale modal.
  if (seenLocationKey !== location.key) {
    setSeenLocationKey(location.key);
    setAccountOpen(false);
  }

  const closeAccount = useCallback(() => setAccountOpen(false), []);

  // Avoid a flash of the tab bar before the session is known.
  if (!user) {
    return null;
  }

  const toggleAccount = () => setAccountOpen((prev) => !prev);

  return (
    <>
      <nav aria-label="Navegación móvil" className={barClassName}>
        <div className="flex h-full items-stretch">
          {TAB_ENTRIES.map((entry) => (
            // `Link`, not `NavLink`: see `useNavEntryActive`.
            <Link
              key={entry.id}
              to={entry.to}
              aria-current={isActive(entry) ? 'page' : undefined}
              className={tabClassName(isActive(entry))}
            >
              <entry.icon className="h-5 w-5" aria-hidden="true" />
              <span>{entry.tabLabel ?? entry.label}</span>
            </Link>
          ))}
          <AccountTab buttonRef={accountTabRef} open={accountOpen} onClick={toggleAccount} />
        </div>
      </nav>
      <MobileAccountDrawer
        open={accountOpen}
        onClose={closeAccount}
        returnFocusRef={accountTabRef}
      />
    </>
  );
};
