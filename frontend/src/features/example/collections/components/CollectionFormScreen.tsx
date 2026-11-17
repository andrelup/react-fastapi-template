import { useNavigate, useParams } from 'react-router-dom';
import { NotFoundState } from '@/components/ui/NotFoundState';
import { ServerErrorState } from '@/components/ui/ServerErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useCollection } from '../hooks/useCollection';
import { CollectionForm } from './CollectionForm';

/**
 * The screen behind `/colecciones/nueva` (create) and
 * `/colecciones/:id/editar` (edit): no `:id` in the route means create. It is
 * ADMIN-only, and `RoleRoute` does all of that gating — nothing here checks a
 * role.
 */
export const CollectionFormScreen = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined;
  const navigate = useNavigate();

  const { data: collection, isLoading, error, status, refetch } = useCollection(Number(id), isEdit);

  if (!isEdit) {
    return <CollectionForm />;
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

  if (!collection) {
    // No data and no error yet — the tick before the first request fires.
    return null;
  }

  return <CollectionForm collection={collection} onReload={() => void refetch()} />;
};
