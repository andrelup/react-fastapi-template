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

// Magnifying glass with a small "x" mark, visually distinct from the plain
// magnifier used by `NotFoundState`.
const SearchWithCrossIcon = () => (
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
    <circle cx="10" cy="10" r="6.5" />
    <path d="M15.1 15.1L20 20" />
    <path d="M7.8 7.8l4.4 4.4" />
    <path d="M12.2 7.8l-4.4 4.4" />
  </svg>
);

/** Shown when a search or filter yields no matching results. */
export const NoResultsState = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  onClearSearch,
  className = '',
}: NoResultsStateProps) => (
  <SystemStateCard
    icon={<SearchWithCrossIcon />}
    title={title}
    description={description}
    action={
      onClearSearch ? (
        <Button variant="secondary" onClick={onClearSearch}>
          Limpiar búsqueda
        </Button>
      ) : undefined
    }
    className={className}
  />
);
