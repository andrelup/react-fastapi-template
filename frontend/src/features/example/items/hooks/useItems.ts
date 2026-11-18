import { useApiOnMount } from '@/hooks/useApiOnMount';
import type { PaginatedResponse } from '@/types/api';
import { getItems, searchItems } from '../api/items-api';
import type { Item } from '../types';

interface UseItemsOptions {
  page: number;
  pageSize?: number;
  category?: string;
  /** Free-text search — when non-empty it hits `/items/search` instead of the
   * plain listing; `category` is sent along. */
  search?: string;
  /** Only the items owned by this user — always goes through `/items/search`,
   * even with no search text, because only that endpoint filters by owner. */
  ownerId?: number;
  /** Skip the request — e.g. while the session that provides `ownerId` is
   * still loading. Defaults to `true`. */
  enabled?: boolean;
}

/** A single-arity request function so `useApiOnMount`'s `args` array stays
 * type-safe, deciding between the plain listing and the search endpoint. */
const fetchItems = (
  page: number,
  pageSize: number,
  category: string | undefined,
  search: string,
  ownerId: number | undefined,
): Promise<PaginatedResponse<Item>> => {
  const trimmedSearch = search.trim();
  return trimmedSearch || ownerId !== undefined
    ? searchItems(trimmedSearch, { page, pageSize, category, ownerId })
    : getItems({ page, pageSize, category });
};

/** Fetches a page of the catalogue on mount and whenever the query changes. */
export const useItems = ({
  page,
  pageSize = 20,
  category,
  search = '',
  ownerId,
  enabled = true,
}: UseItemsOptions) => {
  const { data, isLoading, error, refetch } = useApiOnMount(
    fetchItems,
    [page, pageSize, category, search, ownerId],
    { enabled },
  );

  return { data, isLoading, error, refetch };
};
