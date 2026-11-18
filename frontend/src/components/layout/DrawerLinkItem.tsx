import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DrawerLinkItemProps {
  icon: ReactNode;
  label: string;
  /** Route the entry navigates to. */
  to: string;
  /** Runs on click — the panel uses it to close itself once the user navigates. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** A navigable entry of the account panel. Its inactive counterpart is `NavSoonItem`. */
export const DrawerLinkItem = ({ icon, label, to, onNavigate }: DrawerLinkItemProps) => (
  <Link
    to={to}
    onClick={onNavigate}
    className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px] text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
  >
    <span aria-hidden="true" className="text-body">
      {icon}
    </span>
    <span className="flex-1">{label}</span>
    <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
  </Link>
);
