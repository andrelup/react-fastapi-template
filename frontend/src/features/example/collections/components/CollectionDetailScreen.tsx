import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { useAuth } from '@/features/auth';
import { useApi } from '@/hooks/useApi';
import { deleteCollection } from '../api/collections-api';
import { useCollection } from '../hooks/useCollection';

/**
 * The collection detail screen at `/colecciones/:id`. Pure role, no
 * ownership: every role reads it, only an ADMIN is offered edit and delete.
 * Actions are interface hiding, not security — the backend answers 403.
 */
export const CollectionDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const collectionId = Number(id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const { data: collection, isLoading, error, status, refetch } = useCollection(collectionId);
  const {
    execute: executeDelete,
    isLoading: isDeleting,
    error: deleteError,
  } = useApi(deleteCollection);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (status === 404) {
    return <NotFoundState onGoHome={() => navigate('/')} />;
  }

  if (error) {
    return <ServerErrorState onRetry={refetch} />;
  }

  if (!collection) {
    // The brief tick before `useApiOnMount`'s effect fires the first request.
    return null;
  }

  const isAdmin = hasRole('admin');

  const handleConfirmDelete = async () => {
    const result = await executeDelete(collection.id);
    if (result !== null) {
      navigate('/colecciones');
    } else {
      setIsConfirmOpen(false);
    }
  };

  // The Edit link points at `/colecciones/:id/editar`, the route issue #43
  // ships. Until then it resolves to `NotFoundPage` — expected.
  const actions = (
    <>
      <Button asChild variant="outline" className="flex-1 md:flex-none">
        <Link to={`/colecciones/${collection.id}/editar`}>Editar</Link>
      </Button>
      <Button
        variant="destructive"
        className="flex-1 md:flex-none"
        onClick={() => setIsConfirmOpen(true)}
      >
        Eliminar
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-6 pb-[70px] md:pb-0">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
          {collection.name}
        </h1>
        {collection.description && (
          <p className="mt-2 max-w-[640px] text-[15px] text-body md:text-base">
            {collection.description}
          </p>
        )}
      </div>

      <section>
        <h2 className="font-serif text-xl font-bold text-ink">Artículos</h2>
        {collection.items.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {collection.items.map((item) => (
              <li key={item.id}>
                <Link to={`/items/${item.id}`} className="text-primary hover:underline">
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Esta colección todavía no tiene artículos.</p>
        )}
      </section>

      {deleteError && (
        <p
          role="alert"
          className="rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning"
        >
          No se pudo eliminar la colección: {deleteError}
        </p>
      )}

      {isAdmin && (
        <div className="hidden gap-3 md:flex" role="group" aria-label="Acciones de la colección">
          {actions}
        </div>
      )}

      {isAdmin && (
        <MobileActionBar>
          <div
            role="group"
            aria-label="Acciones de la colección (móvil)"
            className="flex flex-1 gap-3"
          >
            {actions}
          </div>
        </MobileActionBar>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Eliminar colección"
        description={`¿Seguro que quieres eliminar «${collection.name}»? Los artículos no se eliminan. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar colección"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};
