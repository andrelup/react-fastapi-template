import { useApiOnMount } from '@/hooks/useApiOnMount';
import type { PaginatedResponse } from '@/types/api';
import { getCollections } from '../api/collections-api';
import type { Collection } from '../types';

interface UseCollectionsOptions {
  page: number;
  pageSize?: number;
}

const fetchCollections = (page: number, pageSize: number): Promise<PaginatedResponse<Collection>> =>
  getCollections({ page, pageSize });

/** Fetches a page of collections on mount and whenever the page changes. */
export const useCollections = ({ page, pageSize = 20 }: UseCollectionsOptions) => {
  const { data, isLoading, error, refetch } = useApiOnMount(fetchCollections, [page, pageSize]);

  return { data, isLoading, error, refetch };
};
