# BookShelf Frontend — Bulletproof React Architecture

SPA for a bookstore. This CLAUDE.md complements the monorepo root CLAUDE.md.

## Stack

- React 18
- TypeScript (strict mode)
- Vite (build + dev server)
- TailwindCSS (styling)
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
│   │   ├── providers.tsx          # AuthProvider, QueryProvider, etc.
│   │   └── router.tsx             # Route definitions with React Router v6
│   │
│   ├── features/                  # DOMAIN MODULES — each feature is autonomous
│   │   ├── auth/
│   │   │   ├── api/               # Backend calls (login, register, logout)
│   │   │   │   └── auth-api.ts
│   │   │   ├── components/        # Components exclusive to auth
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── hooks/             # Auth hooks
│   │   │   │   ├── useAuth.ts
│   │   │   │   └── useLogin.ts
│   │   │   ├── types/             # Auth TypeScript types
│   │   │   │   └── index.ts
│   │   │   └── index.ts           # Feature public API (re-exports)
│   │   │
│   │   ├── books/
│   │   │   ├── api/
│   │   │   │   └── books-api.ts
│   │   │   ├── components/
│   │   │   │   ├── BookCard.tsx
│   │   │   │   ├── BookList.tsx
│   │   │   │   ├── BookDetail.tsx
│   │   │   │   └── BookSearch.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useBooks.ts
│   │   │   │   └── useBookSearch.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── wishlist/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   └── seller/
│   │       ├── api/
│   │       ├── components/
│   │       │   ├── SellerDashboard.tsx
│   │       │   ├── BookForm.tsx
│   │       │   └── SellerBookList.tsx
│   │       ├── hooks/
│   │       ├── types/
│   │       └── index.ts
│   │
│   ├── components/                # SHARED components (generic reusable UI)
│   │   ├── ui/                    # Primitives: Button, Input, Modal, Card, Spinner
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Spinner.tsx
│   │   └── layout/                # Layout: Header, Footer, Sidebar, PageContainer
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── PageContainer.tsx
│   │
│   ├── hooks/                     # SHARED hooks (generic, not feature-specific)
│   │   ├── useApi.ts              # fetch wrapper with auth header and error handling
│   │   ├── useDebounce.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── lib/                       # External library configuration
│   │   └── api-client.ts          # Base fetch/axios instance with baseURL and interceptors
│   │
│   ├── types/                     # Shared global types
│   │   └── api.ts                 # ApiResponse<T>, PaginatedResponse<T>, etc.
│   │
│   └── utils/                     # Pure helper functions (no side effects)
│       ├── format-price.ts
│       └── validate-isbn.ts
│
├── e2e/                           # E2E tests with Playwright
│   ├── tests/
│   │   ├── auth.spec.ts
│   │   ├── books.spec.ts
│   │   └── wishlist.spec.ts
│   └── page-objects/              # Page Object Model
│       ├── LoginPage.ts
│       └── CatalogPage.ts
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
└── Dockerfile
```

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

4. **Components in the root `components/` are generic UI** with no business logic: Button, Input, Modal, Card, Spinner. They import from no feature.

5. **Hooks in the root `hooks/` are generic** and reusable in any feature: useApi, useDebounce, useLocalStorage. They contain no business logic.

6. **`app/` contains wiring only:** providers, router, and the root component. It contains no UI components and no business logic.

## Code conventions

- Functional components with hooks. No class components.
- PascalCase for components: `BookCard.tsx`, `LoginForm.tsx`
- camelCase for hooks: `useAuth.ts`, `useBooks.ts`
- kebab-case for utility and API files: `books-api.ts`, `format-price.ts`
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

- TailwindCSS for all styling. No CSS modules, no styled-components, no inline CSS.
- Tailwind classes directly in the JSX.
- For component variants, use conditional logic with template literals:
  ```typescript
  const buttonClass = `px-4 py-2 rounded ${variant === 'primary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`;
  ```
- Do not create `.css` files other than `index.css` with the Tailwind directives.

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
- Colocation: unit tests next to the component (`BookCard.test.tsx` next to `BookCard.tsx`)
- Test behavior, not implementation. Use `getByRole`, `getByText`, not `getByTestId`.
- Run: `npx vitest run --coverage`

## Routing

- React Router v6 with routes defined in `app/router.tsx`
- Lazy loading for the main pages:
  ```typescript
  const BookDetail = lazy(() => import('@/features/books/components/BookDetail'));
  ```
- Protected routes with the `ProtectedRoute` component from `features/auth`
- Seller routes kept separate with their own layout

## Path aliases

- `@/` points to `src/`:
  ```typescript
  import { BookCard } from '@/features/books';
  import { Button } from '@/components/ui/Button';
  import { useApi } from '@/hooks/useApi';
  ```
- Configured in `tsconfig.json` and `vite.config.ts`

## What NOT to do

- Do not import a feature's internal components from outside — only what its `index.ts` exports
- Do not put business logic in the root `components/` — those are pure UI
- Do not use `any` — use `unknown` with type guards
- Do not create individual CSS files — use Tailwind
- Do not use `useEffect` to fetch data — use the `useApi` hook, which already handles loading/error
- Do not put global state (Context) in place for data that only one feature uses
- Do not fetch directly with `window.fetch` — always go through `lib/api-client.ts`
