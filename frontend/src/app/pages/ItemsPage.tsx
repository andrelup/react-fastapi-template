import { useSearchParams } from 'react-router-dom';
import { ItemsCatalog } from '@/features/example/items';

/** Catalogue screen at `/items`, visible to all three roles. `?mine=true`
 * narrows it to the session user's own items («Mis items» in the navigation). */
const ItemsPage = () => {
  const [searchParams] = useSearchParams();
  const mine = searchParams.get('mine') === 'true';

  // The key remounts the catalogue when switching view, so the page, search
  // and category of one view never leak into the other.
  return <ItemsCatalog key={mine ? 'mine' : 'all'} mine={mine} />;
};

// Default export required for React.lazy().
export default ItemsPage;
