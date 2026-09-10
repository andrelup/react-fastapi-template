import { FileQuestionMark } from 'lucide-react';
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

/** Shown for 404 routes: the requested page or resource does not exist. */
export const NotFoundState = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onGoHome,
  className,
}: NotFoundStateProps) => (
  <SystemStateCard
    icon={
      <FileQuestionMark className="h-12 w-12 text-muted" strokeWidth={1.5} aria-hidden="true" />
    }
    title={title}
    description={description}
    action={
      onGoHome ? (
        <Button variant="outline" onClick={onGoHome}>
          Volver al inicio
        </Button>
      ) : undefined
    }
    className={className}
  />
);
