/** Catalogue route. */
export const ITEMS_PATH = '/items';

/** The catalogue narrowed to the session user's own items («Mis items»). The
 * navigation links to it and the catalogue page reads it back with
 * `isMineView`, so the contract lives in this one place. */
export const MY_ITEMS_PATH = `${ITEMS_PATH}?mine=true`;

/** Whether a query string asks for the owner view (`?mine=true`). */
export const isMineView = (params: URLSearchParams): boolean => params.get('mine') === 'true';
