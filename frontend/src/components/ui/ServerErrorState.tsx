import { Button } from '@/components/ui/Button';
import { SystemStateCard } from '@/components/ui/SystemStateCard';

interface ServerErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

const DEFAULT_TITLE = 'Error del servidor';
const DEFAULT_DESCRIPTION =
  'Algo ha fallado de nuestro lado. Inténtalo de nuevo en unos minutos.';

const WarningTriangleIcon = () => (
  <svg
    className="h-12 w-12 text-danger"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3.5l10 17.3H2L12 3.5z" />
    <path d="M12 10v4.5" />
    <path d="M12 17.5h.01" />
  </svg>
);

/** Shown when a request fails with a server-side (5xx) error. */
export const ServerErrorState = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onRetry,
  className = '',
}: ServerErrorStateProps) => (
  <SystemStateCard
    icon={<WarningTriangleIcon />}
    title={title}
    description={description}
    action={
      onRetry ? (
        <Button variant="danger" onClick={onRetry}>
          Reintentar
        </Button>
      ) : undefined
    }
    className={className}
  />
);
