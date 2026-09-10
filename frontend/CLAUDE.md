# react-template Frontend — Bulletproof React Architecture

SPA for a bookstore. This CLAUDE.md complements the monorepo root CLAUDE.md.

## Documentation

The documentation map lives in the monorepo root CLAUDE.md. Open only the document the current task calls for — never load them all.

## Stack

- React 18
- TypeScript (strict mode)
- Vite (build + dev server)
- TailwindCSS (styling) + `tailwindcss-animate`
- shadcn/ui as the component base — copied into `components/ui/`, not a dependency — over Radix
  primitives, with `class-variance-authority` for variants, `clsx` + `tailwind-merge` behind the
  `cn` helper, and `lucide-react` for icons
- React Router v6 (routing)
- Vitest + React Testing Library (testing)
- Playwright (E2E)
- ESLint + Prettier (linting + formatting)

## Bulletproof React Architecture

```
frontend/
├── src/
│   ├── app/                       # Entrypoint, global providers, router
│   │   ├── App.tsx                # Root component
│   │   ├── main.tsx               # ReactDOM entrypoint
│   │   ├── providers.tsx          # Global provider composition
│   │   ├── router.tsx             # Route table (react-router-dom)
│   │   └── pages/                 # One component per route
│   │       ├── HomePage.tsx
│   │       ├── LoginPage.tsx
│   │       ├── RegisterPage.tsx
│   │       ├── DashboardPage.tsx          # Seller-only, behind RoleRoute
│   │       ├── UiComponentsPage.tsx       # Live catalogue at /components-ui
│   │       └── NotFoundPage.tsx
│   │
│   ├── features/                  # Self-contained feature modules
│   │   ├── auth/                  # The only fully built feature
│   │   │   ├── api/auth-api.ts            # /auth/login, /auth/register, /auth/me
│   │   │   ├── components/
│   │   │   │   ├── AuthProvider.tsx       # Session state, restored from localStorage
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ProtectedRoute.tsx     # Requires a session
│   │   │   │   └── RoleRoute.tsx          # Requires a session AND a role
│   │   │   ├── context/auth-context.ts
│   │   │   ├── hooks/                     # useAuth, useLogin
│   │   │   ├── types/index.ts
│   │   │   └── index.ts                   # Public contract of the feature
│   │   ├── seller/                # Only SellerDashboard.tsx so far
│   │   ├── books/                 # EMPTY: index.ts is `export {};`
│   │   └── wishlist/              # EMPTY: index.ts is `export {};`
│   │
│   ├── components/
│   │   ├── ui/                    # Generic, no business logic. shadcn/ui, on the project tokens
│   │   │   ├── Button.tsx  Input.tsx  InputControl.tsx  Label.tsx
│   │   │   ├── Card.tsx  Dialog.tsx  Avatar.tsx  Badge.tsx  Spinner.tsx
│   │   │   └── EmptyState.tsx  NoResultsState.tsx  NotFoundState.tsx
│   │   │       ServerErrorState.tsx  SystemStateCard.tsx
│   │   └── layout/                # Layout, Header, Footer, Sidebar, PageContainer,
│   │                              # MobileTabBar, MobileActionBar, MobileAccountDrawer
│   │
│   ├── hooks/                     # Generic: useApi, useDebounce, useLocalStorage
│   ├── lib/api-client.ts          # The ONLY place allowed to call fetch
│   ├── lib/utils.ts               # `cn` — the only sanctioned way to build a class string
│   ├── types/api.ts               # ApiResponse<T>, PaginatedResponse<T>
│   ├── utils/                     # format-price, get-initials
│   └── test/setup.ts              # Vitest setup (jest-dom + cleanup)
│
├── e2e/                           # Playwright, Page Object Model
│   ├── tests/auth.spec.ts
│   ├── page-objects/LoginPage.ts
│   └── tsconfig.json              # e2e/ is outside the src tsconfig
│
├── package.json
├── vite.config.ts                 # Vite + Vitest + coverage thresholds
├── tsconfig.json
├── tailwind.config.ts             # Only var(--…) mappings — no values live here
├── components.json                # shadcn/ui CLI config (written by hand, never `init`)
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
├── nginx.conf                     # Used by the production image
└── Dockerfile
```

Unit tests are colocated next to what they cover (`Button.test.tsx`) and are omitted from the tree.
Anything not listed above does not exist yet — in particular `books/` and `wishlist/` hold only a
`.gitkeep` and an `index.ts` exporting nothing.

## Bulletproof React Architecture rules

1. **Every feature is an autonomous module.** It has its own folder with api/, components/, hooks/, types/ and an `index.ts` that acts as its public API.

2. **A feature does NOT import directly from another feature.** If `wishlist` needs the `Book` type, that type must live in the global `types/`, or the `books` feature must export it from its `index.ts` and `wishlist` imports it from `@/features/books`.

3. **Each feature's `index.ts` is its public contract.** Only what is exported there is accessible from outside:

   ```typescript
   // features/auth/index.ts
   export { LoginForm } from './components/LoginForm';
   export { RegisterForm } from './components/RegisterForm';
   export { ProtectedRoute } from './components/ProtectedRoute';
   export { useAuth } from './hooks/useAuth';
   export type { User, LoginCredentials } from './types';
   ```

4. **Components in the root `components/` are generic UI** with no business logic: Button, Input, Dialog, Card, Spinner. They import from no feature.

5. **Hooks in the root `hooks/` are generic** and reusable in any feature: useApi, useDebounce, useLocalStorage. They contain no business logic.

6. **`app/` contains wiring only:** providers, router, and the root component. It contains no UI components and no business logic.

## Code conventions

- Functional components with hooks. No class components.
- PascalCase for components: `LoginForm.tsx`, `SystemStateCard.tsx`
- camelCase for hooks: `useAuth.ts`, `useLocalStorage.ts`
- kebab-case for utility and API files: `auth-api.ts`, `format-price.ts`
- TypeScript strict mode is mandatory. Do not use `any` — use `unknown` and narrowing.
- Named exports always. No default exports (except pages, for lazy loading).
- Props defined with `interface`, not `type`:
  ```typescript
  interface BookCardProps {
    book: Book;
    onAddToWishlist: (bookId: number) => void;
  }

  export const BookCard = ({ book, onAddToWishlist }: BookCardProps) => {
    // ...
  };
  ```

## State

- **React Context** for auth (logged-in user, token). Provider in `app/providers.tsx`.
- **Local state** (`useState`, `useReducer`) for everything else. Do not add Redux or Zustand.
- **Server data** handled with the `useApi` hook (fetch + loading/error/data state).
- If a piece of state is needed in more than one feature → lift it to Context or move it to a shared hook.

## Styling

Full rules in [docs/frontend-ui-components.md](../docs/frontend-ui-components.md). The short version:

- TailwindCSS for all styling. No CSS modules, no styled-components, no inline CSS.
- **The palette is changed in exactly one place:** the `:root` block of `src/app/index.css`.
  `tailwind.config.ts` holds no values, only `var(--…)` mappings — never write a literal there.
- **No colour value in a component.** No hex, no `rgb()`, no default Tailwind palette class
  (`slate-*`, `zinc-*`, `neutral-*`, `gray-*`, `blue-*`…), no arbitrary colour between brackets.
  Only the token classes: `bg-primary`, `text-ink`, `text-body`, `text-muted`, `border-border`,
  `bg-bg`, `bg-surface`, `text-danger`. There are no blue tokens.
- **Compose classes with `cn`** (`@/lib/utils`), so a caller's `className` wins over the
  component's defaults. **Declare variants with `cva`**, exported next to the component.
- **Icons come from `lucide-react`.** No hand-written inline SVG, no second icon library.
- Do not create `.css` files other than `index.css` with the Tailwind directives.

## The `/components-ui` catalogue is binding

**No screen uses a component that is not shown in `/components-ui`**
(`src/app/pages/UiComponentsPage.tsx`). If a feature needs one that is not there: take it from the
shadcn/ui docs, adapt it to the tokens and to the conventions above, add it to `/components-ui` with
its real states (disabled, loading, with an error, empty), write its test, and only then use it.
Never run `shadcn init` — it rewrites `index.css` and `tailwind.config.ts` with its own tokens.

## API Client

- A single `api-client.ts` in `lib/` with the base configuration:
  ```typescript
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  ```
- Every backend call goes through this client.
- The JWT token is injected automatically from the AuthContext.
- Responses typed with generics: `ApiResponse<Book>`, `ApiResponse<Book[]>`.

## Testing

- **Unit tests:** Vitest + React Testing Library
- **E2E tests:** Playwright with the Page Object Model
- Colocation: unit tests next to the component (`Button.test.tsx` next to `Button.tsx`)
- Test behavior, not implementation. Use `getByRole`, `getByText`, not `getByTestId`.
- Run: `npm run test` (single pass) / `npm run test:watch` (watch mode)
- Coverage: `npm run test:coverage` — enforces 80 % thresholds (statements, lines, branches,
  functions) configured in the `test.coverage` block of `vite.config.ts`. The command fails if any
  metric drops below the threshold.
- `make test-front` from the monorepo root runs the same suite; `make test` runs backend + frontend.

## Routing

- React Router v6 with routes defined in `app/router.tsx`
- Lazy loading for the main pages:
  ```typescript
  const HomePage = lazy(() => import('@/app/pages/HomePage'));
  ```
- Protected routes with the `ProtectedRoute` component from `features/auth`
- Role-restricted routes with `RoleRoute` (e.g. `/dashboard` for `seller`). There is a single
  `Layout`; roles gate a route, they do not get a layout of their own

## Path aliases

- `@/` points to `src/`:
  ```typescript
  import { useAuth } from '@/features/auth';
  import { Button } from '@/components/ui/Button';
  import { useApi } from '@/hooks/useApi';
  ```
- Configured in `tsconfig.json` and `vite.config.ts`

## What NOT to do

- Do not import a feature's internal components from outside — only what its `index.ts` exports
- Do not put business logic in the root `components/` — those are pure UI
- Do not use `any` — use `unknown` with type guards
- Do not create individual CSS files — use Tailwind
- Do not write a colour in a component, and do not add a value to `tailwind.config.ts` — the palette lives in the `:root` of `app/index.css` and nowhere else
- Do not use in a screen a component that is not in `/components-ui`
- Do not use `useEffect` to fetch data — use the `useApi` hook, which already handles loading/error
- Do not put global state (Context) in place for data that only one feature uses
- Do not fetch directly with `window.fetch` — always go through `lib/api-client.ts`
