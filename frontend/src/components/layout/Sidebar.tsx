import { Link, useNavigate } from 'react-router-dom';
// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `ProtectedRoute` already
// relies on), so the Sidebar reads it directly via `useAuth()` instead of
// receiving `user`/`onLogout` as props.
import { useAuth } from '@/features/auth';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { NavGroup } from '@/components/layout/NavGroup';
import { NavSoonItem } from '@/components/layout/NavSoonItem';
import { SIDEBAR_GROUPS, isSoonEntry } from '@/components/layout/navigation';
import { useNavEntryActive } from '@/components/layout/useNavEntryActive';

export interface SidebarProps {
  className?: string;
}

const navLinkClassName = (isActive: boolean) =>
  cn(
    'block rounded px-3 py-2 text-sm',
    isActive ? 'bg-primary-50 font-semibold text-primary-dark' : 'text-body hover:bg-bg',
  );

/** Left sidebar shown for logged-in users: profile, grouped navigation, and logout. */
export const Sidebar = ({ className }: SidebarProps) => {
  const { user, logout } = useAuth();
  const isActive = useNavEntryActive();
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
        'md:sticky md:top-header md:h-[calc(100dvh-theme(spacing.header))] md:self-start',
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
        {SIDEBAR_GROUPS.map((group) => (
          <NavGroup key={group.id} label={group.label}>
            {group.entries.map((entry) =>
              isSoonEntry(entry) ? (
                <NavSoonItem key={entry.id} label={entry.label} className="px-3 py-2 text-sm" />
              ) : (
                // `Link`, not `NavLink`: `aria-current` must follow `useNavEntryActive`
                // (`NavLink` ignores the query string, which two `/items` entries need).
                <Link
                  key={entry.id}
                  to={entry.to}
                  aria-current={isActive(entry) ? 'page' : undefined}
                  className={navLinkClassName(isActive(entry))}
                >
                  {entry.label}
                </Link>
              ),
            )}
          </NavGroup>
        ))}
      </nav>

      <div className="mt-auto border-t border-border p-4">
        <Button variant="destructive" className="w-full" onClick={handleLogout}>
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
};
