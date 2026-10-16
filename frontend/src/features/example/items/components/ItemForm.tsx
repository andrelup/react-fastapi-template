import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useApiOnMount } from '@/hooks/useApiOnMount';
import { ApiError } from '@/types/api';
import {
  createItem,
  createTag,
  getCollectionRefs,
  getItem,
  searchTags,
  setItemCollections,
  updateItem,
} from '../api/items-api';
import { CATEGORY_CHOICES } from './category-options';
import type { ItemDetail, ItemInput } from '../types';

const NAME_MAX_LENGTH = 200;
const SLUG_MAX_LENGTH = 200;
const TAG_MAX_LENGTH = 50;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NO_CATEGORY = 'none';
const HTTP_CONFLICT = 409;

const SLUG_HINT = 'Solo minúsculas, números y guiones, por ejemplo «camara-analogica».';
const DUPLICATE_SLUG_MESSAGE = 'Ya existe un item con este slug';
const STALE_VERSION_MESSAGE =
  'Alguien ha modificado este item mientras lo editabas. Carga la última versión para no pisar sus cambios.';

const validateName = (value: string): string | undefined => {
  if (!value.trim()) {
    return 'El nombre es obligatorio';
  }
  if (value.trim().length > NAME_MAX_LENGTH) {
    return `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`;
  }
  return undefined;
};

const validateSlug = (value: string): string | undefined => {
  const slug = value.trim();
  if (!slug) {
    return 'El slug es obligatorio';
  }
  if (slug.length > SLUG_MAX_LENGTH) {
    return `El slug no puede superar los ${SLUG_MAX_LENGTH} caracteres`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return `El slug no es válido. ${SLUG_HINT}`;
  }
  return undefined;
};

const toCollectionOption = (ref: { id: number; name: string }): ComboboxOption => ({
  value: String(ref.id),
  label: ref.name,
});

const toIds = (options: ComboboxOption[]): number[] =>
  options.map((option) => Number(option.value));

const haveSameIds = (left: number[], right: number[]): boolean =>
  left.length === right.length && left.every((id) => right.includes(id));

const messageOf = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Error inesperado. Inténtalo de nuevo.';

const isConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.status === HTTP_CONFLICT;

interface ItemFormProps {
  /** The item being edited; absent when creating. */
  item?: ItemDetail;
  /** A message to show above the form, e.g. after a half-finished creation. */
  notice?: string;
  /** Re-fetches the item so the form restarts from the latest version. */
  onReload?: () => void;
}

/** The form shared by item creation and edition. */
export const ItemForm = ({ item, notice, onReload }: ItemFormProps) => {
  const navigate = useNavigate();

  const [name, setName] = useState(item?.name ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [category, setCategory] = useState(item?.category ?? NO_CATEGORY);
  // Tags are keyed by NAME: the payload carries names, and the names of the
  // item's current tags are all the detail endpoint gives us.
  const [tags, setTags] = useState<ComboboxOption[]>(
    () => item?.tags.map((tag) => ({ value: tag, label: tag })) ?? [],
  );
  const [collections, setCollections] = useState<ComboboxOption[]>(
    () => item?.collections.map(toCollectionOption) ?? [],
  );

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [slugError, setSlugError] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  // Latest version known to the server for this item. It moves ahead of
  // `item.version` once our own update succeeds, so a retry after a failed
  // collections call does not look like someone else's edit.
  const [knownVersion, setKnownVersion] = useState(item?.version ?? 0);
  const [isStale, setIsStale] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [tagOptions, setTagOptions] = useState<ComboboxOption[]>([]);
  const [isSearchingTags, setIsSearchingTags] = useState(false);

  const { data: collectionRefs, error: collectionsError } = useApiOnMount(getCollectionRefs, []);
  const [collectionQuery, setCollectionQuery] = useState('');

  const unknownCategory =
    item?.category && !CATEGORY_CHOICES.some((choice) => choice.value === item.category)
      ? item.category
      : null;
  const categoryOptions: SelectOption[] = [
    { value: NO_CATEGORY, label: 'Sin categoría' },
    ...CATEGORY_CHOICES,
    // An item may carry a category the static list does not know about.
    ...(unknownCategory ? [{ value: unknownCategory, label: unknownCategory }] : []),
  ];

  const normalizedCollectionQuery = collectionQuery.trim().toLowerCase();
  const collectionOptions = (collectionRefs ?? [])
    .filter((ref) => ref.name.toLowerCase().includes(normalizedCollectionQuery))
    .map(toCollectionOption);

  const handleSearchTags = async (query: string, signal: AbortSignal): Promise<void> => {
    setIsSearchingTags(true);
    try {
      const found = await searchTags(query.trim().slice(0, TAG_MAX_LENGTH));
      // `apiClient` takes no AbortSignal, so a superseded response is
      // dropped here instead of being cancelled.
      if (signal.aborted) {
        return;
      }
      setTagOptions(found.map((tag) => ({ value: tag.name, label: tag.name })));
    } catch {
      if (!signal.aborted) {
        setTagOptions([]);
      }
    } finally {
      if (!signal.aborted) {
        setIsSearchingTags(false);
      }
    }
  };

  const handleCreateTag = async (tagName: string): Promise<ComboboxOption> => {
    const trimmed = tagName.trim();
    if (trimmed.length < 1 || trimmed.length > TAG_MAX_LENGTH) {
      throw new Error(`La etiqueta debe tener entre 1 y ${TAG_MAX_LENGTH} caracteres`);
    }
    const tag = await createTag(trimmed);
    return { value: tag.name, label: tag.name };
  };

  const handleCreate = async (payload: ItemInput): Promise<void> => {
    let created;
    try {
      created = await createItem(payload);
    } catch (error) {
      // On create a 409 can only be a duplicate slug.
      if (isConflict(error)) {
        setSlugError(DUPLICATE_SLUG_MESSAGE);
      } else {
        setFormError(messageOf(error));
      }
      return;
    }

    if (collections.length > 0) {
      try {
        await setItemCollections(created.id, toIds(collections), created.version);
      } catch {
        // The item exists already, so retrying "create" would duplicate it.
        navigate(`/items/${created.id}/editar`, { state: { collectionsNotSaved: true } });
        return;
      }
    }
    navigate(`/items/${created.id}`);
  };

  const handleUpdate = async (current: ItemDetail, payload: ItemInput): Promise<void> => {
    let updated;
    try {
      updated = await updateItem(current.id, payload, knownVersion);
    } catch (error) {
      if (!isConflict(error)) {
        setFormError(messageOf(error));
        return;
      }
      // A 409 is either a stale version or a duplicate slug. The text of the
      // error is never parsed; the item's fresh version tells them apart.
      try {
        const fresh = await getItem(current.id);
        if (fresh.version !== knownVersion) {
          setIsStale(true);
        } else {
          setSlugError(DUPLICATE_SLUG_MESSAGE);
        }
      } catch (refetchError) {
        setFormError(messageOf(refetchError));
      }
      return;
    }

    setKnownVersion(updated.version);
    const nextIds = toIds(collections);
    if (
      !haveSameIds(
        current.collections.map((ref) => ref.id),
        nextIds,
      )
    ) {
      try {
        await setItemCollections(current.id, nextIds, updated.version);
      } catch (error) {
        // Always a stale version: the version used was the one just returned.
        if (isConflict(error)) {
          setIsStale(true);
        } else {
          setFormError(messageOf(error));
        }
        return;
      }
    }
    navigate(`/items/${current.id}`);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(undefined);
    setIsStale(false);

    const nextNameError = validateName(name);
    const nextSlugError = validateSlug(slug);
    setNameError(nextNameError);
    setSlugError(nextSlugError);

    if (nextNameError !== undefined || nextSlugError !== undefined) {
      return;
    }

    // Only confirmed tags are in `tags`: one whose creation failed never is.
    const payload: ItemInput = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() === '' ? null : description.trim(),
      category: category === NO_CATEGORY ? null : category,
      tags: tags.map((option) => option.label),
    };

    setIsSaving(true);
    try {
      if (item) {
        await handleUpdate(item, payload);
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
        {item ? 'Editar item' : 'Nuevo item'}
      </h1>

      {notice && (
        <p
          role="status"
          className="rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning"
        >
          {notice}
        </p>
      )}

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
        <div className="flex flex-col gap-1">
          <Input
            id="slug"
            label="Slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            error={slugError}
            required
          />
          <p className="text-sm text-muted">{SLUG_HINT}</p>
        </div>
        <Textarea
          id="description"
          label="Descripción"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Select
          id="category"
          label="Categoría"
          options={categoryOptions}
          value={category}
          onValueChange={setCategory}
        />
        <Combobox
          label="Etiquetas"
          placeholder="Buscar o crear etiquetas…"
          options={tagOptions}
          value={tags}
          onValueChange={setTags}
          onSearch={(query, signal) => void handleSearchTags(query, signal)}
          isLoading={isSearchingTags}
          allowCreate
          onCreate={handleCreateTag}
        />
        <Combobox
          label="Colecciones"
          placeholder="Buscar colecciones…"
          options={collectionOptions}
          value={collections}
          onValueChange={setCollections}
          onSearch={(query) => setCollectionQuery(query)}
          isLoading={collectionRefs === null && collectionsError === null}
          allowCreate={false}
          error={collectionsError ? 'No se pudieron cargar las colecciones' : undefined}
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
        {formError && (
          <p role="alert" className="text-sm text-warning">
            {formError}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" isLoading={isSaving}>
            {item ? 'Guardar cambios' : 'Crear item'}
          </Button>
          <Button asChild variant="outline">
            <Link to={item ? `/items/${item.id}` : '/items'}>Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  );
};
