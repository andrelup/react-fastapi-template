import { useApiOnMount } from '@/hooks/useApiOnMount';
import { getCollection } from '../api/collections-api';

/** Fetches a single collection (fields plus its items) on mount and
 * whenever `id` changes. Pass `enabled = false` to skip the fetch, e.g. on
 * the create form. */
export const useCollection = (id: number, enabled = true) =>
  useApiOnMount(getCollection, [id], { enabled });
