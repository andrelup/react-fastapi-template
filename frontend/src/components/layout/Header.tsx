// Cross-cutting exception to the "components/ imports from no feature" rule:
// auth is global Context state (the same reasoning `Sidebar` already relies
// on), so the Header reads it directly via `useAuth()` instead of receiving
// `user` as a prop.
import { useAuth } from '@/features/auth';

const CartIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.435m0 0L6.75 14.25a1.125 1.125 0 0 0 1.11.975h9.508a1.125 1.125 0 0 0 1.11-.9l1.264-6.75a1.125 1.125 0 0 0-1.11-1.35H5.106m0 0L4.5 5.25M7.5 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm9 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
    />
  </svg>
);

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
        Book<span className="text-primary">Shelf</span>
      </span>

      {/*
        On mobile these functions live in the `MobileTabBar` instead: the
        search bar has no dedicated screen yet, and the seller/customer
        actions are covered by the tab bar's "Añadir libro" FAB and
        "Carrito" tab respectively.
      */}
      {user && (
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <input
            type="search"
            aria-label="Buscar"
            placeholder="Buscar por título, autor o ISBN…"
            className="w-full max-w-md rounded-full bg-bg px-4 py-2 text-sm text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-primary-50"
          />
        </div>
      )}

      {user?.role === 'seller' && (
        <button
          type="button"
          // TODO: open "Publicar libro"
          className="hidden rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover md:inline-flex"
        >
          + Vender libro
        </button>
      )}

      {user?.role === 'customer' && (
        <button
          type="button"
          aria-label="Carrito (3)"
          // TODO: connect to real cart count when the cart feature exists
          className="relative hidden h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-primary-dark md:flex"
        >
          <CartIcon />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-semibold text-white">
            3
          </span>
        </button>
      )}
    </header>
  );
};
