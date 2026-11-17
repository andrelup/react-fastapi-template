import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/types/api';
import { createCollection, getCollection, updateCollection } from '../api/collections-api';
import type { Collection, CollectionInput } from '../types';

const NAME_MAX_LENGTH = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

const DUPLICATE_NAME_MESSAGE = 'Ya existe una colección con ese nombre';
const STALE_VERSION_MESSAGE =
  'Alguien ha modificado esta colección mientras la editabas. Carga la última versión para no pisar sus cambios.';
const GONE_MESSAGE = 'Esta colección ya no existe: alguien la ha borrado mientras la editabas.';
const FORBIDDEN_MESSAGE = 'No tienes permiso para crear ni editar colecciones.';

const validateName = (value: string): string | undefined => {
  if (!value.trim()) {
    return 'El nombre es obligatorio';
  }
  if (value.trim().length > NAME_MAX_LENGTH) {
    return `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`;
  }
  return undefined;
};

const statusOf = (error: unknown): number | undefined =>
  error instanceof ApiError ? error.status : undefined;

const messageOf = (error: unknown): string => {
  if (!(error instanceof ApiError)) {
    return 'Error inesperado. Inténtalo de nuevo.';
  }
  // The role was revoked after the page loaded: RoleRoute let the user in.
  return error.status === HTTP_FORBIDDEN ? FORBIDDEN_MESSAGE : error.message;
};

const isConflict = (error: unknown): boolean => statusOf(error) === HTTP_CONFLICT;

interface CollectionFormProps {
  /** The collection being edited; absent when creating. */
  collection?: Collection;
  /** Re-fetches the collection so the form restarts from the latest version. */
  onReload?: () => void;
}

/** The form shared by collection creation and edition. */
export const CollectionForm = ({ collection, onReload }: CollectionFormProps) => {
  const navigate = useNavigate();

  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [isStale, setIsStale] = useState(false);
  const [isGone, setIsGone] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /** A failed update or re-fetch: a 404 means the collection was deleted. */
  const showUpdateFailure = (error: unknown): void => {
    if (statusOf(error) === HTTP_NOT_FOUND) {
      setIsGone(true);
    } else {
      setFormError(messageOf(error));
    }
  };

  const handleCreate = async (payload: CollectionInput): Promise<void> => {
    try {
      const created = await createCollection(payload);
      navigate(`/colecciones/${created.id}`);
    } catch (error) {
      // On create a 409 can only be a duplicate name.
      if (isConflict(error)) {
        setNameError(DUPLICATE_NAME_MESSAGE);
      } else {
        setFormError(messageOf(error));
      }
    }
  };

  const handleUpdate = async (current: Collection, payload: CollectionInput): Promise<void> => {
    try {
      await updateCollection(current.id, payload, current.version);
      navigate(`/colecciones/${current.id}`);
    } catch (error) {
      if (!isConflict(error)) {
        showUpdateFailure(error);
        return;
      }
      // A 409 is either a stale version or a duplicate name. The text of the
      // error is never parsed; the collection's fresh version tells them apart.
      try {
        const fresh = await getCollection(current.id);
        if (fresh.version !== current.version) {
          setIsStale(true);
        } else {
          setNameError(DUPLICATE_NAME_MESSAGE);
        }
      } catch (refetchError) {
        showUpdateFailure(refetchError);
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    setIsStale(false);

    const nextNameError = validateName(name);
    setNameError(nextNameError);
    if (nextNameError !== undefined) {
      return;
    }

    const payload: CollectionInput = {
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
    };

    setIsSaving(true);
    try {
      if (collection) {
        await handleUpdate(collection, payload);
      } else {
        await handleCreate(payload);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
        {collection ? 'Editar colección' : 'Nueva colección'}
      </h1>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex max-w-[640px] flex-col gap-4"
        noValidate
      >
        <Input
          id="name"
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
          required
        />
        <Textarea
          id="description"
          label="Descripción"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        {isStale && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning"
          >
            <p>{STALE_VERSION_MESSAGE}</p>
            {onReload && (
              <Button type="button" variant="outline" size="sm" onClick={onReload}>
                Cargar la última versión
              </Button>
            )}
          </div>
        )}
        {isGone && (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning"
          >
            <p>{GONE_MESSAGE}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/colecciones">Volver a las colecciones</Link>
            </Button>
          </div>
        )}
        {formError && (
          <p role="alert" className="text-sm text-warning">
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          {/* Once the collection is gone every save would 404 again. `disabled`
              overrides `isLoading`'s own disabling, so both are passed. */}
          <Button type="submit" isLoading={isSaving} disabled={isGone || isSaving}>
            {collection ? 'Guardar cambios' : 'Crear colección'}
          </Button>
          <Button asChild variant="outline">
            <Link to={collection ? `/colecciones/${collection.id}` : '/colecciones'}>Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
};
