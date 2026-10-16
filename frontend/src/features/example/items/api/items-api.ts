import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { CollectionRef, Item, ItemDetail, ItemFilters, ItemInput, Tag } from '../types';

const DEFAULT_PAGE_SIZE = 20;

/** Raw shape returned by the backend for a single item, snake_case fields. */
interface RawItem {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  owner_id: number;
  version: number;
}

/** Raw shape of the paginated envelope's content, before it is unwrapped
 * from `ApiResponse` by `apiClient` and mapped onto the domain type here. */
interface RawPaginatedItems {
  items: RawItem[];
  total: number;
  page: number;
  page_size: number;
}

/** Raw shape returned by `GET /items/{id}` — `RawItem` plus the collections
 * the item belongs to. The listing endpoints never send `collections`. */
interface RawItemDetail extends RawItem {
  collections: CollectionRef[];
}

const toItem = (raw: RawItem): Item => ({
  id: raw.id,
  name: raw.name,
  description: raw.description,
  category: raw.category,
  tags: raw.tags,
  ownerId: raw.owner_id,
  version: raw.version,
});

const toItemDetail = (raw: RawItemDetail): ItemDetail => ({
  ...toItem(raw),
  collections: raw.collections,
});

const toPaginatedItems = (raw: RawPaginatedItems): PaginatedResponse<Item> => ({
  items: raw.items.map(toItem),
  total: raw.total,
  page: raw.page,
  pageSize: raw.page_size,
});

/** Builds a `?a=1&b=2` query string, dropping `undefined` and empty values.
 * `api-client` has no query-param helper, so each feature builds its own. */
const buildQueryString = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });
  const serialised = query.toString();
  return serialised ? `?${serialised}` : '';
};

/** `GET /items` — paginated listing, optionally narrowed by `category`. */
export const getItems = async (filters: ItemFilters = {}): Promise<PaginatedResponse<Item>> => {
  const { page = 1, pageSize = DEFAULT_PAGE_SIZE, category } = filters;
  const query = buildQueryString({ page, page_size: pageSize, category });
  const raw = await apiClient.get<RawPaginatedItems>(`/items${query}`);
  return toPaginatedItems(raw);
};

/** `GET /items/search` — free-text search over the catalogue. */
export const searchItems = async (
  search: string,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PaginatedResponse<Item>> => {
  const query = buildQueryString({ q: search, page, page_size: pageSize });
  const raw = await apiClient.get<RawPaginatedItems>(`/items/search${query}`);
  return toPaginatedItems(raw);
};

/** `GET /items/{id}` — a single item plus the collections it belongs to. */
export const getItem = async (id: number): Promise<ItemDetail> => {
  const raw = await apiClient.get<RawItemDetail>(`/items/${id}`);
  return toItemDetail(raw);
};

/** `DELETE /items/{id}` — ADMIN only; the backend enforces the role. */
export const deleteItem = async (id: number): Promise<void> => {
  await apiClient.delete<null>(`/items/${id}`);
};

/** Raw shape of `GET /tags` — the tags come wrapped, not as a bare list. */
interface RawTagList {
  tags: Tag[];
}

/** Raw shape of `GET /collections` — only the fields the picker needs. */
interface RawCollectionPage {
  items: { id: number; name: string }[];
}

/** The collections endpoint has no "all" mode; this is its page-size cap. */
const COLLECTIONS_PAGE_SIZE = 100;

/** `POST /items` — the owner comes from the token. */
export const createItem = async (input: ItemInput): Promise<Item> =>
  toItem(await apiClient.post<RawItem>('/items', input));

/** `PUT /items/{id}` — a FULL replace, so the whole payload is always sent.
 * `version` is the optimistic-lock token the item was loaded with. */
export const updateItem = async (id: number, input: ItemInput, version: number): Promise<Item> =>
  toItem(await apiClient.put<RawItem>(`/items/${id}`, { ...input, version }));

/** `PUT /items/{id}/collections` — replaces the set of collections the item
 * is filed in. Needs the item's CURRENT version; a 409 means it is stale. */
export const setItemCollections = async (
  id: number,
  collectionIds: number[],
  version: number,
): Promise<ItemDetail> =>
  toItemDetail(
    await apiClient.put<RawItemDetail>(`/items/${id}/collections`, {
      collection_ids: collectionIds,
      version,
    }),
  );

/** `GET /tags?q=` — at most 50 tags whose name matches the query. */
export const searchTags = async (query: string): Promise<Tag[]> => {
  const raw = await apiClient.get<RawTagList>(`/tags${buildQueryString({ q: query })}`);
  return raw.tags.map(({ id, name }) => ({ id, name }));
};

/** `POST /tags` — idempotent: returns the existing tag when the name is taken. */
export const createTag = async (name: string): Promise<Tag> => {
  const raw = await apiClient.post<Tag>('/tags', { name });
  return { id: raw.id, name: raw.name };
};

/** `GET /collections` — every collection as an `{id, name}` reference, for
 * the picker. Lives here and not in a collections feature so `items` never
 * imports from it. */
export const getCollectionRefs = async (): Promise<CollectionRef[]> => {
  const query = buildQueryString({ page: 1, page_size: COLLECTIONS_PAGE_SIZE });
  const raw = await apiClient.get<RawCollectionPage>(`/collections${query}`);
  return raw.items.map(({ id, name }) => ({ id, name }));
};
