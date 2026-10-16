import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth';
import { useItem } from '../hooks/useItem';
import { ItemForm } from './ItemForm';

const COLLECTIONS_NOT_SAVED_MESSAGE =
  'El artículo se creó, pero sus colecciones no se pudieron guardar. Vuelve a elegirlas y guarda.';

/**
 * The screen behind `/items/nuevo` (create) and `/items/:id/editar` (edit):
 * no `:id` in the route means create. Role gating is `RoleRoute`'s job; what
 * it cannot do, because it depends on the item, is the ownership check done
 * here once the item has loaded.
 */
export const ItemFormScreen = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();

  const { data: item, isLoading, error, status, refetch } = useItem(Number(id), isEdit);

  if (!isEdit) {
    return <ItemForm />;
  }

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
    // No data and no error yet — the tick before the first request fires.
    return null;
  }

  // An EDITOR may edit only their own items. Anyone else gets the 404 screen,
  // so the item's existence is never revealed.
  if (!hasRole('admin') && user?.id !== item.ownerId) {
    return <NotFoundState onGoHome={() => navigate('/')} />;
  }

  const state = location.state as { collectionsNotSaved?: boolean } | null;

  return (
    <ItemForm
      item={item}
      notice={state?.collectionsNotSaved ? COLLECTIONS_NOT_SAVED_MESSAGE : undefined}
      onReload={() => void refetch()}
    />
  );
};
