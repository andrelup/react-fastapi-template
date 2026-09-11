import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';

/** Neutral welcome home page, shown right after login. */
const HomePage = () => {
  const { user } = useAuth();

  return (
    <>
      <h1 className="font-serif text-3xl font-bold tracking-[-0.015em] text-ink md:text-[34px]">
        Hola{user?.name ? `, ${user.name}` : ''}
      </h1>
      <p className="mt-2 max-w-[460px] text-[15px] text-body md:text-base">
        Este es el punto de partida de tu cuenta.
      </p>
      <Button asChild className="mt-6">
        <Link to="/items">Explorar catálogo</Link>
      </Button>
    </>
  );
};

// Default export required for React.lazy().
export default HomePage;
