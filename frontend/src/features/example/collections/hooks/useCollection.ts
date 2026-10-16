import { useApiOnMount } from '@/hooks/useApiOnMount';
import { getCollection } from '../api/collections-api';

/** Fetches a single collection (fields plus its items) on mount and
 * whenever `id` changes. */
export const useCollection = (id: number) => useApiOnMount(getCollection, [id]);
