import { CollectionsList } from '@/features/example/collections';

/** Collections listing at `/colecciones`, visible to all three roles. */
const CollectionsPage = () => <CollectionsList />;

// Default export required for React.lazy().
export default CollectionsPage;
