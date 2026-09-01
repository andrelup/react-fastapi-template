import { Button } from '@/components/ui/Button';
import { SystemStateCard } from '@/components/ui/SystemStateCard';

interface NotFoundStateProps {
  title?: string;
  description?: string;
  onGoHome?: () => void;
  className?: string;
}

const DEFAULT_TITLE = 'Página no encontrada';
const DEFAULT_DESCRIPTION = 'La ruta que buscas no existe o se ha movido a otra dirección.';

const PlainMagnifierIcon = () => (
  <svg
    className="h-12 w-12 text-muted"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="M20 20l-5.5-5.5" />
  </svg>
);

/** Shown for 404 routes: the requested page or resource does not exist. */
export const NotFoundState = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onGoHome,
  className = '',
}: NotFoundStateProps) => (
  <SystemStateCard
    icon={<PlainMagnifierIcon />}
    title={title}
    description={description}
    action={
      onGoHome ? (
        <Button variant="secondary" onClick={onGoHome}>
          Volver al inicio
        </Button>
      ) : undefined
    }
    className={className}
  />
);
