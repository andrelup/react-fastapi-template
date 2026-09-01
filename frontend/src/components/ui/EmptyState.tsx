import { Button } from '@/components/ui/Button';
import { SystemStateCard } from '@/components/ui/SystemStateCard';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyBoxIcon = () => (
  <svg
    className="h-12 w-12 text-primary"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8l9-5 9 5-9 5-9-5z" />
    <path d="M3 8v8l9 5 9-5V8" />
    <path d="M12 13v8" />
  </svg>
);

/** Generic empty-state screen: use it wherever a list or collection has no items yet. */
export const EmptyState = ({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) => (
  <SystemStateCard
    icon={<EmptyBoxIcon />}
    title={title}
    description={description}
    action={
      actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : undefined
    }
    className={className}
  />
);
