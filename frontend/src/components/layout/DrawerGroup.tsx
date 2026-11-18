import type { ReactNode } from 'react';
import { useId } from 'react';

interface DrawerGroupProps {
  label: string;
  children: ReactNode;
}

/** A headed group of account-panel entries — the mobile counterpart of the `Sidebar`'s `NavGroup`. */
export const DrawerGroup = ({ label, children }: DrawerGroupProps) => {
  const headingId = useId();

  return (
    <div role="group" aria-labelledby={headingId} className="mb-3">
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
