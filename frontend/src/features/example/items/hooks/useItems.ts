import { useApiOnMount } from '@/hooks/useApiOnMount';
import type { PaginatedResponse } from '@/types/api';
import { getItems, searchItems } from '../api/items-api';
import type { Item } from '../types';

interface UseItemsOptions {
  page: number;
  pageSize?: number;
  category?: string;
  /** Free-text search — when non-empty it takes over from `category` and hits
   * `/items/search` instead of the plain listing. */
  search?: string;
}

/** A single-arity request function so `useApiOnMount`'s `args` array stays
 * type-safe, deciding between the plain listing and the search endpoint. */
const fetchItems = (
  page: number,
  pageSize: number,
  category: string | undefined,
  search: string,
): Promise<PaginatedResponse<Item>> => {
  const trimmedSearch = search.trim();
  return trimmedSearch
    ? searchItems(trimmedSearch, page, pageSize)
    : getItems({ page, pageSize, category });
};

/** Fetches a page of the catalogue on mount and whenever the query changes. */
export const useItems = ({ page, pageSize = 20, category, search = '' }: UseItemsOptions) => {
  const { data, isLoading, error, refetch } = useApiOnMount(fetchItems, [
    page,
    pageSize,
    category,
    search,
  ]);

  return { data, isLoading, error, refetch };
};
