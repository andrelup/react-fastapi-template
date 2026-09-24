/** Item — the catalogue's hub resource. Mirrors `ItemORM` in
 * `backend/src/adapters/outbound/persistence/example/item.py`. */
export interface Item {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  ownerId: number;
  version: number;
}

/** Filters accepted by `getItems` — every field is optional. */
export interface ItemFilters {
  page?: number;
  pageSize?: number;
  category?: string;
}

/** A collection an item belongs to, as shown on the item detail screen. */
export interface CollectionRef {
  id: number;
  name: string;
}

/** `Item` plus the collections it belongs to — only `GET /items/{id}`
 * returns this shape; the listing endpoints keep returning plain `Item`. */
export interface ItemDetail extends Item {
  collections: CollectionRef[];
}
