import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the drawer reads it directly via `useAuth()`.
import { useAuth } from '@/features/auth';
import { DrawerLinkItem } from '@/components/layout/DrawerLinkItem';
import { MobileAccountPanel } from '@/components/layout/MobileAccountPanel';
import { NavGroup } from '@/components/layout/NavGroup';
import { NavSoonItem } from '@/components/layout/NavSoonItem';
import { DRAWER_GROUPS, isSoonEntry } from '@/components/layout/navigation';
import { DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/Dialog';

const ICON_CLASS = 'h-5 w-5';
// `md:` is where desktop begins (docs/frontend-ui-components.md).
const DESKTOP_QUERY = '(min-width: 768px)';

export interface MobileAccountDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Where focus goes when the panel is dismissed — the tab that opened it. */
  returnFocusRef?: RefObject<HTMLElement>;
}

/**
 * Mobile-only slide-in "Cuenta" panel opened from the `MobileTabBar` account
 * tab. It renders every entry of the navigation config that the tab bar has no
 * room for, under the same group headings as the `Sidebar`, plus the profile
 * block and the logout action. Entries without a route are inactive
 * («Próximamente»), never broken links.
 *
 * It is a modal Radix dialog (through the `ui/Dialog` pieces): focus trap,
 * Escape, `aria-hidden` on the page behind, and a slide/fade animation on both
 * open and close (the Root stays mounted so Presence can play the exit).
 * Three things are explicit:
 * - Crossing to `md` closes it. It is hidden there (`md:hidden`), and a modal
 *   that is invisible but still locking scroll and hiding the app would trap
 *   the user.
 * - Focus returns to the tab only when the user dismisses the panel (Escape,
 *   close button, overlay); after following a link or logging out it is left
 *   to the page.
 * - There is no Radix `Trigger`, so that focus return is done by hand.
 */
export const MobileAccountDrawer = ({
  open,
  onClose,
  returnFocusRef,
}: MobileAccountDrawerProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Set by the paths that close the panel by navigating; read once on close.
  const skipFocusReturn = useRef(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = () => {
      if (desktop.matches) {
        onClose();
      }
    };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [open, onClose]);

  if (!user) {
    return null;
  }

  const closeByNavigating = () => {
    skipFocusReturn.current = true;
    onClose();
  };

  const handleLogout = () => {
    logout();
    closeByNavigating();
    navigate('/login');
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay className="md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          aria-modal="true"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!skipFocusReturn.current) {
              returnFocusRef?.current?.focus();
            }
            skipFocusReturn.current = false;
          }}
          className="fixed inset-y-0 right-0 z-50 w-[86%] max-w-[360px] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right md:hidden"
        >
          <DialogTitle className="sr-only">Cuenta</DialogTitle>
          <MobileAccountPanel
            name={user.name}
            email={user.email}
            onClose={onClose}
            onLogout={handleLogout}
            className="h-full w-full max-w-none"
          >
            {DRAWER_GROUPS.map((group) => (
              <NavGroup key={group.id} label={group.label} className="mb-3">
                {group.entries.map((entry) =>
                  isSoonEntry(entry) ? (
                    <NavSoonItem
                      key={entry.id}
                      label={entry.label}
                      icon={<entry.icon className={ICON_CLASS} />}
                      className="rounded-md px-3 py-3 text-[15px]"
                    />
                  ) : (
                    <DrawerLinkItem
                      key={entry.id}
                      label={entry.label}
                      icon={<entry.icon className={ICON_CLASS} />}
                      to={entry.to}
                      onNavigate={closeByNavigating}
                    />
                  ),
                )}
              </NavGroup>
            ))}
          </MobileAccountPanel>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
};
