import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Item, ItemFilters } from '../types';

const DEFAULT_PAGE_SIZE = 20;

/** Raw shape returned by the backend for a single item, snake_case fields. */
interface RawItem {
  id: number;
  name: string;
  slug: string;
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

const toItem = (raw: RawItem): Item => ({
  id: raw.id,
  name: raw.name,
  slug: raw.slug,
  description: raw.description,
  category: raw.category,
  tags: raw.tags,
  ownerId: raw.owner_id,
  version: raw.version,
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
