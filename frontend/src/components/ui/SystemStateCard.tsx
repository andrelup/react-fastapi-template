import type { ReactNode } from 'react';

interface SystemStateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Shared layout for system state screens (empty, no results, 404, 500):
 * centered icon, title, description and an optional action button.
 * Not meant to be used directly by feature code — use one of the
 * `EmptyState` / `NoResultsState` / `NotFoundState` / `ServerErrorState`
 * wrappers instead.
 */
export const SystemStateCard = ({
  icon,
  title,
  description,
  action,
  className = '',
}: SystemStateCardProps) => (
  <div
    className={`flex flex-col items-center rounded-md border border-border bg-bg px-4 py-8 text-center md:px-6 md:py-12 ${className}`}
  >
    {icon}
    <h2 className="mt-4 font-serif text-xl font-bold text-ink">{title}</h2>
    <p className="mt-2 max-w-sm text-sm text-body">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);
