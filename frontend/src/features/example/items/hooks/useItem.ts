import { useApiOnMount } from '@/hooks/useApiOnMount';
import { getItem } from '../api/items-api';

/** Fetches a single item's detail (fields plus its collections) on mount and
 * whenever `id` changes. `getItem` is already a fixed-arity, single-argument
 * function, so it can be passed straight to `useApiOnMount` — no wrapper
 * needed, unlike `useItems`, which reads from two endpoints. */
export const useItem = (id: number) => useApiOnMount(getItem, [id]);
