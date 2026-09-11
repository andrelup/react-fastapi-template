import { ItemsCatalog } from '@/features/example/items';

/** Catalogue screen at `/items`, visible to all three roles. */
const ItemsPage = () => <ItemsCatalog />;

// Default export required for React.lazy().
export default ItemsPage;
