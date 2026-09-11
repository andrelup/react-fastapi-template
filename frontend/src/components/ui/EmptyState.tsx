import { PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SystemStateCard } from '@/components/ui/SystemStateCard';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** Generic empty-state screen: use it wherever a list or collection has no items yet. */
export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) => (
  <SystemStateCard
    icon={<PackageOpen className="h-12 w-12 text-primary" strokeWidth={1.5} aria-hidden="true" />}
    title={title}
    description={description}
    action={
      actionLabel && onAction ? (
        <Button variant="default" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : undefined
    }
    className={className}
  />
);
