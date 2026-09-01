import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  className?: string;
}

/** Generic status pill. Pure UI, no business logic. */
export const Badge = ({ children, className = '' }: BadgeProps) => (
  <span
    className={`rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-dark ${className}`}
  >
    {children}
  </span>
);
