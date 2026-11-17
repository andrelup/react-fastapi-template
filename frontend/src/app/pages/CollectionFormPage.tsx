import { CollectionFormScreen } from '@/features/example/collections';

/** Collection create (`/colecciones/nueva`) and edit (`/colecciones/:id/editar`) screen, ADMIN only. */
const CollectionFormPage = () => <CollectionFormScreen />;

// Default export required for React.lazy().
export default CollectionFormPage;
