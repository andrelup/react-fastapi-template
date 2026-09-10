// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar` already relies
// on), so the Header reads it directly via `useAuth()` instead of receiving
// `user` as a prop.
import { useAuth } from '@/features/auth';

export const Header = () => {
  const { user } = useAuth();

  return (
    <header
      className={`flex h-14 items-center border-b border-border bg-surface px-4 md:h-[62px] md:px-7 ${
        // On mobile the auth navbar centers the lone logo (no session yet);
        // the logged-in navbar keeps it left with search/actions on the right.
        user ? 'justify-between' : 'justify-center md:justify-start'
      }`}
    >
      {/*
        TODO: add a "Volver" (back) button here (mobile only, left of the
        logo) once detail screens exist — see design system section 10.
      */}
      <span className="font-serif text-[17px] font-bold text-ink md:text-[21px]">
        Mi<span className="text-primary">App</span>
      </span>

      {/*
        On mobile the search bar has no dedicated screen yet, and the
        remaining primary actions live in the `MobileTabBar` (Inicio +
        Cuenta) instead.
      */}
      {user && (
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <input
            type="search"
            aria-label="Buscar"
            placeholder="Buscar…"
            className="w-full max-w-md rounded-full bg-bg px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-primary-50"
          />
        </div>
      )}
    </header>
  );
};
