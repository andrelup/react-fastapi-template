import type { ReactNode } from 'react';
import { LogOut, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface MobileAccountPanelProps {
  name: string;
  email: string;
  onClose: () => void;
  onLogout: () => void;
  /** The `NavGroup`s of the menu. */
  children: ReactNode;
  /** Positioning is the caller's: the drawer pins it to the right edge, the
   * `/components-ui` mock lays it out inline. */
  className?: string;
}

/**
 * The visible slide-over panel of the mobile account menu: title and close
 * button, profile block, the menu groups and logout. Presentational — it
 * reads neither the session nor the router state, so the `MobileAccountDrawer`
 * feeds it the real user and menus and `/components-ui` feeds it static ones.
 */
export const MobileAccountPanel = ({
  name,
  email,
  onClose,
  onLogout,
  children,
  className,
}: MobileAccountPanelProps) => (
  <div className={cn('flex w-[86%] max-w-[360px] flex-col bg-surface shadow-float', className)}>
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Cuenta</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cerrar"
        onClick={onClose}
        className="h-8 w-8 bg-bg hover:bg-border"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>

    <div className="px-4">
      <div className="flex items-center gap-3 rounded-md bg-primary-50 p-3">
        <Avatar name={name} size="md" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{name}</p>
          <p className="truncate text-[13px] text-muted">{email}</p>
        </div>
      </div>
    </div>

    <nav aria-label="Menú de cuenta" className="flex-1 overflow-auto px-4 py-3">
      {children}
    </nav>

    <div className="border-t border-border p-4">
      <Button variant="destructive" className="w-full" onClick={onLogout}>
        <LogOut aria-hidden="true" />
        Cerrar sesión
      </Button>
    </div>
  </div>
);
