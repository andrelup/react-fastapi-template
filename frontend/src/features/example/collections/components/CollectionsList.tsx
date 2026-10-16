import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListingCard } from '@/components/ui/ListingCard';
import { Pagination } from '@/components/ui/Pagination';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth';
import { useCollections } from '../hooks/useCollections';

const PAGE_SIZE = 20;

/** The collections listing at `/colecciones`. Every role reads it; only an
 * ADMIN is offered the create action (the backend enforces it too). */
export const CollectionsList = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useCollections({ page, pageSize: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
            Colecciones
          </h1>
          <p className="mt-2 max-w-[460px] text-[15px] text-body md:text-base">
            Agrupaciones editoriales de artículos del catálogo.
          </p>
        </div>
        {hasRole('admin') && (
          // The create route is built by issue #43; until then this link
          // resolves to `NotFoundPage` — expected.
          <Button asChild>
            <Link to="/colecciones/nueva">Nueva colección</Link>
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!isLoading && error && <ServerErrorState onRetry={refetch} />}

      {!isLoading && !error && data && data.items.length === 0 && (
        <EmptyState
          title="Todavía no hay colecciones"
          description="Cuando se creen colecciones, aparecerán aquí."
        />
      )}

      {!isLoading && !error && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((collection) => (
              <ListingCard
                key={collection.id}
                title={collection.name}
                description={collection.description ?? undefined}
                onSelect={() => navigate(`/colecciones/${collection.id}`)}
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
