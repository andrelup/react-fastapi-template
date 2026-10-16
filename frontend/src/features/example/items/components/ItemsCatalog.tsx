import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { NoResultsState } from '@/components/ui/NoResultsState';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth';
import { ALL_CATEGORIES, CATEGORY_OPTIONS } from '../category-options';
import { useItems } from '../hooks/useItems';

const PAGE_SIZE = 20;

/** The catalogue screen: paginated listing, free-text search and a category
 * filter. Visible to all three roles — the example domain has no owner-only
 * view yet. */
export const ItemsCatalog = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);

  const { data, isLoading, error, refetch } = useItems({
    page,
    pageSize: PAGE_SIZE,
    category,
    search,
  });

  const hasActiveFilters = search.trim() !== '' || category !== undefined;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value === ALL_CATEGORIES ? undefined : value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch('');
    setCategory(undefined);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
            Catálogo
          </h1>
          <p className="mt-2 max-w-[460px] text-[15px] text-body md:text-base">
            Explora los artículos publicados en el catálogo.
          </p>
        </div>
        {hasRole('editor') && (
          <Button asChild className="self-start">
            <Link to="/items/nuevo">Nuevo item</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <SearchInput
          label="Buscar en el catálogo"
          placeholder="Buscar por nombre…"
          onSearch={handleSearch}
          className="md:max-w-sm"
        />
        <Select
          label="Categoría"
          options={CATEGORY_OPTIONS}
          value={category ?? ALL_CATEGORIES}
          onValueChange={handleCategoryChange}
          className="md:max-w-xs"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!isLoading && error && <ServerErrorState onRetry={refetch} />}

      {!isLoading && !error && data && data.items.length === 0 && hasActiveFilters && (
        <NoResultsState onClearSearch={handleClearSearch} />
      )}

      {!isLoading && !error && data && data.items.length === 0 && !hasActiveFilters && (
        <EmptyState
          title="Todavía no hay artículos"
          description="Cuando se publiquen artículos en el catálogo, aparecerán aquí."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <ListingCard
                key={item.id}
                title={item.name}
                description={item.description ?? undefined}
                badge={item.category ? <Badge>{item.category}</Badge> : undefined}
                meta={item.tags.length > 0 ? item.tags.join(', ') : undefined}
                onSelect={() => navigate(`/items/${item.id}`)}
              />
            ))}
          </div>
          <Pagination
            page={data.page}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={setPage}
            disabled={isLoading}
          />
        </>
      )}
    </div>
  );
};
