import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NavSoonItemProps {
  label: string;
  icon?: ReactNode;
  /** Size and spacing of the host surface (`Sidebar` or account panel). */
  className?: string;
}

/**
 * An inactive navigation entry: its page does not exist yet, so it is not a
 * link. It carries the «Próximamente» pill because `aria-disabled` on a
 * role-less `div` is not announced — the visible text is what tells everyone.
 * Turn it into a real link in the same change that adds the route.
 */
export const NavSoonItem = ({ label, icon, className }: NavSoonItemProps) => (
  <div aria-disabled="true" className={cn('flex items-center gap-3 rounded text-body', className)}>
    {icon && <span aria-hidden="true">{icon}</span>}
    <span className="flex-1">{label}</span>
    <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-muted">
      Próximamente
    </span>
  </div>
);
