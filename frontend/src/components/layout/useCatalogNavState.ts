import { useLocation } from 'react-router-dom';

interface CatalogNavState {
  /** "Explorar catálogo" / the "Catálogo" tab: the catalogue and any item, but not the owner view. */
  catalogActive: boolean;
  /** "Mis items": the catalogue narrowed to the session's own items. */
  mineActive: boolean;
}

/**
 * Active state of the two entries that share the `/items` path. `NavLink`
 * ignores the query string, so it would mark "Explorar catálogo" and "Mis
 * items" at the same time; both navigations (`Sidebar`, `MobileTabBar`) use
 * this one rule instead.
 */
export const useCatalogNavState = (): CatalogNavState => {
  const { pathname, search } = useLocation();

  const inCatalog = pathname === '/items' || pathname.startsWith('/items/');
  const mineActive = pathname === '/items' && new URLSearchParams(search).get('mine') === 'true';

  return { catalogActive: inCatalog && !mineActive, mineActive };
};
