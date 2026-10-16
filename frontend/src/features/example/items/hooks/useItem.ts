import { useApiOnMount } from '@/hooks/useApiOnMount';
import { getItem } from '../api/items-api';

/** Fetches a single item's detail (fields plus its collections) on mount and
 * whenever `id` changes. `getItem` is already a fixed-arity, single-argument
 * function, so it can be passed straight to `useApiOnMount` — no wrapper
 * needed, unlike `useItems`, which reads from two endpoints. Pass
 * `enabled = false` to skip the fetch, e.g. on the create form. */
export const useItem = (id: number, enabled = true) => useApiOnMount(getItem, [id], { enabled });
