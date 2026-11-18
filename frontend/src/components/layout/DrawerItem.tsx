import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SoonPill } from '@/components/layout/SoonPill';
import { cn } from '@/lib/utils';

interface DrawerItemBaseProps {
  icon: ReactNode;
  label: string;
}

interface DrawerLinkItemProps extends DrawerItemBaseProps {
  /** Route the entry navigates to. */
  to: string;
  /** Runs on click — the panel uses it to close itself once the user navigates. */
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
  soon?: never;
}

interface DrawerInactiveItemProps extends DrawerItemBaseProps {
  /** An upcoming section: no route yet, so it shows the «Próximamente» pill and is not a link. */
  soon: true;
  to?: never;
  onNavigate?: never;
}

export type DrawerItemProps = DrawerLinkItemProps | DrawerInactiveItemProps;

const itemClassName = 'flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[15px]';

/**
 * One entry of the account panel. Two variants, mirroring the `Sidebar`:
 * a real link (`to`), or an inactive entry (`soon`) with its «Próximamente»
 * pill. An inactive entry is never a link — turn it into one once its route
 * exists.
 */
export const DrawerItem = ({ icon, label, to, soon, onNavigate }: DrawerItemProps) => {
  if (soon) {
    return (
      <div aria-disabled="true" className={cn(itemClassName, 'text-body')}>
        <span aria-hidden="true">{icon}</span>
        <span className="flex-1">{label}</span>
        <SoonPill />
      </div>
    );
  }

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        itemClassName,
        'text-ink hover:bg-bg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
      )}
    >
      <span aria-hidden="true" className="text-body">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
    </Link>
  );
};
