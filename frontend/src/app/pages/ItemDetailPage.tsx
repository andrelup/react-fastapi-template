import { ItemDetailScreen } from '@/features/example/items';

/** Item detail screen at `/items/:id`, visible to all three roles. */
const ItemDetailPage = () => <ItemDetailScreen />;

// Default export required for React.lazy().
export default ItemDetailPage;
