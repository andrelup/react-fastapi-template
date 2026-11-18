import { matchPath, useLocation } from 'react-router-dom';
import { ITEMS_PATH, isMineView } from '@/lib/paths';
import type { NavLinkEntry } from '@/components/layout/navigation';

/**
 * Returns the one rule every navigation surface uses to mark an entry active.
 * `NavLink` ignores the query string, so it would mark «Explorar catálogo» and
 * «Mis items» together (both live on `/items`); this resolves them explicitly:
 * the owner view is `/items` with `mine=true`, and the catalogue is `/items`
 * and `/items/*` otherwise. Paths go through `matchPath`, so they match as
 * the router does: case-insensitive and ignoring a trailing slash.
 */
export const useNavEntryActive = () => {
  const { pathname, search } = useLocation();

  const onCatalog = matchPath({ path: ITEMS_PATH, end: false }, pathname) !== null;
  const onOwnerView =
    matchPath({ path: ITEMS_PATH, end: true }, pathname) !== null &&
    isMineView(new URLSearchParams(search));

  return (entry: NavLinkEntry): boolean => {
    if (entry.active === 'mine') {
      return onOwnerView;
    }
    if (entry.active === 'catalog') {
      return onCatalog && !onOwnerView;
    }
    return matchPath({ path: entry.to, end: entry.end ?? false }, pathname) !== null;
  };
};
