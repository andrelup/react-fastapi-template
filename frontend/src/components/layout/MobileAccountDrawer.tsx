import { FolderOpen, MessageCircle, Package, Palette, Settings, Star, UserPen } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the drawer reads it directly via `useAuth()`.
import { useAuth } from '@/features/auth';
import { DrawerGroup } from '@/components/layout/DrawerGroup';
import { DrawerItem } from '@/components/layout/DrawerItem';
import { DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/Dialog';
import { MobileAccountPanel } from '@/components/layout/MobileAccountPanel';

const ICON_CLASS = 'h-5 w-5';

export interface MobileAccountDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Where focus goes when the panel closes — the tab that opened it. */
  returnFocusRef?: RefObject<HTMLElement>;
}

/**
 * Mobile-only slide-in "Cuenta" panel opened from the `MobileTabBar` account
 * tab. It carries every `Sidebar` entry the tab bar has no room for, under the
 * same group headings, plus the logout action: Cuenta, Colecciones and
 * Desarrollo. Entries without a route are inactive («Próximamente»), never
 * broken links. Built on the Radix dialog (through the `ui/Dialog` pieces), so
 * it gets the focus trap, Escape, focus return to the tab and `aria-hidden`
 * on the page behind for free. `navigation-parity.test.tsx` keeps it in step with the
 * `Sidebar`.
 */
export const MobileAccountDrawer = ({
  open,
  onClose,
  returnFocusRef,
}: MobileAccountDrawerProps) => {
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
    <DialogPrimitive.Root open onOpenChange={(next) => !next && onClose()}>
      <DialogPortal>
        <DialogOverlay className="md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          aria-modal="true"
          // There is no Radix `Trigger`, so focus return is explicit.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef?.current?.focus();
          }}
          className="fixed inset-y-0 right-0 z-50 w-[86%] max-w-[360px] md:hidden"
        >
          <DialogTitle className="sr-only">Cuenta</DialogTitle>
          <MobileAccountPanel
            name={user.name}
            email={user.email}
            onClose={onClose}
            onLogout={handleLogout}
            className="h-full w-full max-w-none"
          >
            <DrawerGroup label="Cuenta">
              <DrawerItem
                icon={<Package className={ICON_CLASS} />}
                label="Mis items"
                to="/items?mine=true"
                onNavigate={onClose}
              />
              <DrawerItem icon={<MessageCircle className={ICON_CLASS} />} label="Mensajes" soon />
              <DrawerItem icon={<Settings className={ICON_CLASS} />} label="Ajustes" soon />
              <DrawerItem icon={<UserPen className={ICON_CLASS} />} label="Editar perfil" soon />
            </DrawerGroup>

            <DrawerGroup label="Colecciones">
              <DrawerItem
                icon={<FolderOpen className={ICON_CLASS} />}
                label="Ver colecciones"
                to="/colecciones"
                onNavigate={onClose}
              />
              <DrawerItem
                icon={<Star className={ICON_CLASS} />}
                label="Colecciones destacadas"
                soon
              />
            </DrawerGroup>

            <DrawerGroup label="Desarrollo">
              <DrawerItem
                icon={<Palette className={ICON_CLASS} />}
                label="Componentes UI"
                to="/components-ui"
                onNavigate={onClose}
              />
            </DrawerGroup>
          </MobileAccountPanel>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
};
