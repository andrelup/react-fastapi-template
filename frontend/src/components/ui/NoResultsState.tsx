import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SystemStateCard } from '@/components/ui/SystemStateCard';

interface NoResultsStateProps {
  title?: string;
  description?: string;
  onClearSearch?: () => void;
  className?: string;
}

const DEFAULT_TITLE = 'Sin resultados';
const DEFAULT_DESCRIPTION =
  'No hemos encontrado ningún artículo que coincida con tu búsqueda. Prueba con otros términos.';

/** Shown when a search or filter yields no matching results. */
export const NoResultsState = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onClearSearch,
  className,
}: NoResultsStateProps) => (
  // `SearchX` (magnifier with a cross) is deliberately distinct from the plain
  // `FileQuestionMark` used by `NotFoundState`: no results is not a 404.
  <SystemStateCard
    icon={<SearchX className="h-12 w-12 text-muted" strokeWidth={1.5} aria-hidden="true" />}
    title={title}
    description={description}
    action={
      onClearSearch ? (
        <Button variant="outline" onClick={onClearSearch}>
          Limpiar búsqueda
        </Button>
      ) : undefined
    }
    className={className}
  />
);
