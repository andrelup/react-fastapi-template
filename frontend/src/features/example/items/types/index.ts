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

/** The writable fields of an item, in the shape `POST /items` and
 * `PUT /items/{id}` accept. `tags` are tag NAMES; collections are set
 * through their own endpoint and are not part of this payload. */
export interface ItemInput {
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
}

/** A tag from the shared catalogue of tags. */
export interface Tag {
  id: number;
  name: string;
}
