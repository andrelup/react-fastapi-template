import { CollectionDetailScreen } from '@/features/example/collections';

/** Collection detail screen at `/colecciones/:id`, visible to all three roles. */
const CollectionDetailPage = () => <CollectionDetailScreen />;

// Default export required for React.lazy().
export default CollectionDetailPage;
