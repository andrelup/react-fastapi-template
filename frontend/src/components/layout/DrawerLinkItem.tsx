import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DrawerLinkItemProps {
  icon: ReactNode;
  label: string;
  /** Route the entry navigates to. */
  to: string;
  /** Runs on a plain left click, the one that navigates in this tab — the panel uses it
   * to close itself. Modified and middle clicks open a new tab or window and leave the
   * panel alone. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** A navigable entry of the account panel. Its inactive counterpart is `NavSoonItem`. */
export const DrawerLinkItem = ({ icon, label, to, onNavigate }: DrawerLinkItemProps) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const isPlainLeftClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (isPlainLeftClick && !event.defaultPrevented) {
      onNavigate?.(event);
    }
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="text-body">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
    </Link>
  );
};
