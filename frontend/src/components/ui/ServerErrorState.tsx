import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SystemStateCard } from '@/components/ui/SystemStateCard';

interface ServerErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

const DEFAULT_TITLE = 'Error del servidor';
const DEFAULT_DESCRIPTION = 'Algo ha fallado de nuestro lado. Inténtalo de nuevo en unos minutos.';

/** Shown when a request fails with a server-side (5xx) error. */
export const ServerErrorState = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onRetry,
  className,
}: ServerErrorStateProps) => (
  <SystemStateCard
    icon={<TriangleAlert className="h-12 w-12 text-danger" strokeWidth={1.5} aria-hidden="true" />}
    title={title}
    description={description}
    action={
      // The single sanctioned exception to "red is only for destructive
      // actions": the retry button of a failed request.
      onRetry ? (
        <Button variant="destructive" onClick={onRetry}>
          Reintentar
        </Button>
      ) : undefined
    }
    className={className}
  />
);
