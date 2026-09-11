import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  /** 1-based current page. Matches `PaginatedResponse<T>.page`. */
  page: number;
  /** Total row count across every page. Matches `PaginatedResponse<T>.total`. */
  total: number;
  /** Rows per page. Matches `PaginatedResponse<T>.pageSize`. */
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Disables every control — pass it while the page underneath is loading. */
  disabled?: boolean;
  className?: string;
}

const ELLIPSIS = 'ellipsis';
type PageItem = number | typeof ELLIPSIS;

/** First, last, current page and its neighbours; `…` for the gaps between. */
const getPageItems = (page: number, totalPages: number): PageItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const keep = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...keep]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  return sorted.reduce<PageItem[]>((items, value, index) => {
    const previous = sorted[index - 1];
    if (index > 0 && previous !== undefined && value - previous > 1) {
      items.push(ELLIPSIS);
    }
    items.push(value);
    return items;
  }, []);
};

/**
 * Adapted from shadcn/ui `pagination`, driven directly by the fields of
 * `PaginatedResponse<T>` (`page`, `total`, `pageSize`) so a list screen can
 * spread its response straight in: `<Pagination {...response} onPageChange={setPage} />`.
 */
export const Pagination = ({
  page,
  total,
  pageSize,
  onPageChange,
  disabled = false,
  className,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = getPageItems(page, totalPages);

  return (
    <nav
      aria-label="Paginación"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Página anterior"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      {items.map((item, index) =>
        item === ELLIPSIS ? (
          <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? 'outline' : 'ghost'}
            size="icon"
            aria-label={`Página ${item}`}
            aria-current={item === page ? 'page' : undefined}
            disabled={disabled}
            onClick={() => onPageChange(item)}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="outline"
        size="icon"
        aria-label="Página siguiente"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
};
