import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Collection, CollectionDetail, CollectionFilters, ItemRef } from '../types';

const DEFAULT_PAGE_SIZE = 20;

/** Raw shape returned by the backend for a single collection. */
interface RawCollection {
  id: number;
  name: string;
  description: string | null;
  version: number;
}

/** Raw shape of the paginated envelope's content, snake_case. */
interface RawPaginatedCollections {
  items: RawCollection[];
  total: number;
  page: number;
  page_size: number;
}

/** Raw shape of `GET /collections/{id}` — the collection plus its items. */
interface RawCollectionDetail extends RawCollection {
  items: ItemRef[];
}

const toCollection = (raw: RawCollection): Collection => ({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  version: raw.version,
});

const toCollectionDetail = (raw: RawCollectionDetail): CollectionDetail => ({
  ...toCollection(raw),
  items: raw.items.map((item) => ({ id: item.id, name: item.name })),
});

const toPaginatedCollections = (raw: RawPaginatedCollections): PaginatedResponse<Collection> => ({
  items: raw.items.map(toCollection),
  total: raw.total,
  page: raw.page,
  pageSize: raw.page_size,
});

/** `GET /collections` — paginated listing, ordered by name. */
export const getCollections = async (
  filters: CollectionFilters = {},
): Promise<PaginatedResponse<Collection>> => {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = filters;
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const raw = await apiClient.get<RawPaginatedCollections>(`/collections?${query.toString()}`);
  return toPaginatedCollections(raw);
};

/** `GET /collections/{id}` — a single collection plus the items it contains. */
export const getCollection = async (id: number): Promise<CollectionDetail> => {
  const raw = await apiClient.get<RawCollectionDetail>(`/collections/${id}`);
  return toCollectionDetail(raw);
};

/** `DELETE /collections/{id}` — ADMIN only; the backend enforces the role. */
export const deleteCollection = async (id: number): Promise<void> => {
  await apiClient.delete<null>(`/collections/${id}`);
};
