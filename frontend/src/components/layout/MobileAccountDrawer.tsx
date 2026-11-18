import { FolderOpen, MessageCircle, Package, Palette, Settings, Star, UserPen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar`/`Header` already
// rely on), so the drawer reads it directly via `useAuth()`.
import { useAuth } from '@/features/auth';
import { DrawerGroup } from '@/components/layout/DrawerGroup';
import { DrawerItem } from '@/components/layout/DrawerItem';
import { MobileAccountPanel } from '@/components/layout/MobileAccountPanel';

const ICON_CLASS = 'h-5 w-5';
const SOON = 'Próximamente';

export interface MobileAccountDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile-only slide-in "Cuenta" panel opened from the `MobileTabBar` account
 * tab. It carries every `Sidebar` entry the tab bar has no room for, under the
 * same group headings, plus the logout action: Cuenta, Colecciones and
 * Desarrollo. Entries without a route are inactive («Próximamente»), never
 * broken links. `navigation-parity.test.tsx` keeps it in step with the
 * `Sidebar`.
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
    <div
      className="fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Cuenta"
    >
      <button
        type="button"
        aria-label="Cerrar menú de cuenta"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <MobileAccountPanel
        name={user.name}
        email={user.email}
        onClose={onClose}
        onLogout={handleLogout}
        className="absolute inset-y-0 right-0"
      >
        <DrawerGroup label="Cuenta">
          <DrawerItem
            icon={<Package className={ICON_CLASS} />}
            label="Mis items"
            to="/items?mine=true"
            onNavigate={onClose}
          />
          <DrawerItem
            icon={<MessageCircle className={ICON_CLASS} />}
            label="Mensajes"
            soon={SOON}
          />
          <DrawerItem icon={<Settings className={ICON_CLASS} />} label="Ajustes" soon={SOON} />
          <DrawerItem icon={<UserPen className={ICON_CLASS} />} label="Editar perfil" soon={SOON} />
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
            soon={SOON}
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
    </div>
  );
};
