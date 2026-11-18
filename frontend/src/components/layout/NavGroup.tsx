import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface NavGroupProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** A headed group of navigation entries, shared by the `Sidebar` and the account panel: the heading names the group for assistive technology. */
export const NavGroup = ({ label, children, className }: NavGroupProps) => {
  const headingId = useId();

  return (
    <div role="group" aria-labelledby={headingId} className={cn('mb-4', className)}>
      <p
        id={headingId}
        className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted"
      >
        {label}
      </p>
      {children}
    </div>
  );
};
