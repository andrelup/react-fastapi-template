import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';

/** Seller/customer aware welcome home page, shown right after login. */
const HomePage = () => {
  const { user } = useAuth();
  const isSeller = user?.role === 'seller';

  return (
    <>
      <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
        {isSeller ? `Bienvenida, ${user?.name}` : `Bienvenida a BookShelf, ${user?.name ?? ''}`}
      </h1>
      <p className="mt-2 max-w-[460px] text-[15px] text-body md:text-base">
        {isSeller
          ? 'Publica vuestras novedades y gestionad las ventas en BookShelf. Empieza publicando un libro o revisa el catálogo.'
          : 'Descubre nuevas historias y gestiona tus libros favoritos. Empieza explorando el catálogo.'}
      </p>

      <div className="mt-6 flex flex-col gap-2.5 md:mt-7 md:flex-row md:gap-3">
        {isSeller && (
          // TODO: enable navigation once the "publish book" route exists.
          <Button variant="primary" disabled className="w-full md:w-auto">
            Publicar un libro
          </Button>
        )}
        {/* TODO: enable navigation once the catalog route exists. */}
        <Button variant="secondary" disabled className="w-full md:w-auto">
          Explorar catálogo
        </Button>
      </div>
    </>
  );
};

// Default export required for React.lazy().
export default HomePage;
