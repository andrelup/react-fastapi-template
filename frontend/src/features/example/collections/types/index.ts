/** Collection — an editorial grouping of items. It has no owner: access is
 * by role only. */
export interface Collection {
  id: number;
  name: string;
  description: string | null;
  version: number;
}

/** An item as listed inside a collection. Local to this feature: the
 * collections feature links to items by route and imports nothing from the
 * items feature. */
export interface ItemRef {
  id: number;
  name: string;
}

/** `Collection` plus the items it contains — only `GET /collections/{id}`
 * returns this shape; the listing keeps returning plain `Collection`. */
export interface CollectionDetail extends Collection {
  items: ItemRef[];
}

/** Filters accepted by `getCollections` — every field is optional. */
export interface CollectionFilters {
  page?: number;
  pageSize?: number;
}
