import { ItemFormScreen } from '@/features/example/items';

/** Item create (`/items/nuevo`) and edit (`/items/:id/editar`) screen, for ADMIN and EDITOR. */
const ItemFormPage = () => <ItemFormScreen />;

// Default export required for React.lazy().
export default ItemFormPage;
