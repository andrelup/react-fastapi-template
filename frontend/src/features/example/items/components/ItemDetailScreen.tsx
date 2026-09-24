import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { MobileActionBar } from '@/components/layout/MobileActionBar';
import { useAuth } from '@/features/auth';
import { useApi } from '@/hooks/useApi';
import { deleteItem } from '../api/items-api';
import { useItem } from '../hooks/useItem';

/**
 * The item detail screen at `/items/:id`. Named `ItemDetailScreen`, not
 * `ItemDetail`, so it does not collide with the `ItemDetail` type.
 *
 * Actions are interface hiding, not security: the backend already answers
 * 403 to a request a role should not make. This screen only avoids
 * *offering* an action that would fail.
 */
export const ItemDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const { data: item, isLoading, error, status, refetch } = useItem(itemId);
  const { execute: executeDelete, isLoading: isDeleting } = useApi(deleteItem);
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

  if (!item) {
    // No data and no error yet — the brief tick before `useApiOnMount`'s
    // effect fires the first request. Renders nothing rather than flashing
    // an error state.
    return null;
  }

  const canEdit = hasRole('admin') || (user?.role === 'editor' && user.id === item.ownerId);
  const canDelete = hasRole('admin');
  const hasActions = canEdit || canDelete;

  const handleConfirmDelete = async () => {
    const result = await executeDelete(item.id);
    if (result !== null) {
      navigate('/items');
    }
  };

  // The Edit button already points at `/items/:id/editar`, the route issue
  // #41 ships. Until then it resolves to `NotFoundPage` — expected, and the
  // tests below assert the button's visibility, not where it navigates.
  const actions = (
    <>
      {canEdit && (
        <Button asChild variant="outline" className="flex-1 md:flex-none">
          <Link to={`/items/${item.id}/editar`}>Editar</Link>
        </Button>
      )}
      {canDelete && (
        <Button
          variant="destructive"
          className="flex-1 md:flex-none"
          onClick={() => setIsConfirmOpen(true)}
        >
          Eliminar
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-6 pb-[70px] md:pb-0">
      <div>
        {item.category && <Badge className="mb-2">{item.category}</Badge>}
        <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
          {item.name}
        </h1>
        {item.description && (
          <p className="mt-2 max-w-[640px] text-[15px] text-body md:text-base">
            {item.description}
          </p>
        )}
      </div>

      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <section>
        <h2 className="font-serif text-xl font-bold text-ink">Colecciones</h2>
        {item.collections.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {item.collections.map((collection) => (
              <li key={collection.id}>
                <Badge variant="secondary">{collection.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Este artículo no pertenece a ninguna colección.</p>
        )}
      </section>

      {hasActions && (
        <div className="hidden gap-3 md:flex" role="group" aria-label="Acciones del artículo">
          {actions}
        </div>
      )}

      {hasActions && (
        <MobileActionBar>
          <div
            role="group"
            aria-label="Acciones del artículo (móvil)"
            className="flex flex-1 gap-3"
          >
            {actions}
          </div>
        </MobileActionBar>
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title="Eliminar artículo"
        description={`¿Seguro que quieres eliminar «${item.name}»? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar artículo"
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
      />
    </div>
  );
};
