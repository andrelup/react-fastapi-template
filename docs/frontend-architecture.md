# Frontend Architecture

react-fastapi-template SPA — React 18 + TypeScript (strict) + Vite + TailwindCSS + React Router v6, organised
following **Bulletproof React**.

This document describes the architecture **as it is implemented today** and the rules any new
feature must follow. Companion documents: [UI components](./frontend-ui-components.md),
[code style](./frontend-code-style.md), [testing](./frontend-testing.md).

---

## 1. Directory layout

```
frontend/src/
├── app/                     Wiring only — no business logic, no reusable UI
│   ├── main.tsx             ReactDOM entry point, mounts <App/> inside StrictMode
│   ├── App.tsx              <AppProviders><RouterProvider router={router}/></AppProviders>
│   ├── providers.tsx        AppProviders — composes the global providers
│   ├── router.tsx           createBrowserRouter route table + lazy() page imports
│   ├── index.css            The only stylesheet: Tailwind directives + design tokens
│   └── pages/               One file per route, default-exported for React.lazy
│
├── features/                Domain modules — each one autonomous
│   ├── auth/                Fully implemented; the reference feature
│   ├── seller/              Partially implemented (SellerDashboard only)
│   ├── books/               Stub
│   └── wishlist/            Stub
│
├── components/
│   ├── ui/                  Generic primitives (Button, Input, Card, Modal, state screens…)
│   └── layout/              Header, Footer, Sidebar, Layout, mobile navigation
│
├── hooks/                   Generic hooks: useApi, useDebounce, useLocalStorage
├── lib/                     api-client.ts — the single fetch() call site
├── types/                   api.ts — ApiResponse<T>, PaginatedResponse<T>, ApiError
├── utils/                   Pure helpers: format-price, get-initials
└── test/setup.ts            Vitest setup (jest-dom matchers + RTL cleanup)
```

Anything not in this tree does not exist yet. In particular there is **no** `e2e/` directory and
**no** Playwright installation; `books/` and `wishlist/` contain only `.gitkeep` files plus an
`index.ts` holding `export {};`.

---

## 2. Layer rules

The dependency direction is strictly one-way:

```
app/  ──▶  features/  ──▶  components/ui, hooks/, lib/, types/, utils/
                    ╲
                     ──▶  another feature's public API (index.ts) only
```

1. **`app/` contains wiring only.** Providers, the router and the page shells. A page component is
   a thin wrapper that renders a feature component; business logic never lives here.
2. **A feature is autonomous.** It owns `api/`, `components/`, `hooks/`, `types/` and an `index.ts`
   that is its public contract. Anything not exported from `index.ts` is private to the feature.
3. **A feature never reaches into another feature's internals.** Importing `@/features/auth` is
   allowed; importing `@/features/auth/components/LoginForm` is not. `SellerDashboard` consuming
   `useAuth` from `@/features/auth` is the compliant pattern.
4. **`components/ui/` holds pure UI.** No business logic, no feature imports, no data fetching.
5. **`components/layout/` is the one documented exception.** `Layout`, `Header`, `Sidebar`,
   `MobileTabBar` and `MobileAccountDrawer` import `useAuth` from `@/features/auth`, because
   navigation is inherently session- and role-aware. The exception is annotated in each file and
   must not be extended to other shared components without the same justification written down.
6. **`hooks/`, `lib/`, `types/` and `utils/` are feature-agnostic.** They must still compile with
   every feature deleted.

---

## 3. Routing

All routes live in a single `createBrowserRouter` call in `app/router.tsx`, nested under one
`<Layout/>` route element.

| Path | Page | Guard |
|---|---|---|
| `/` | `HomePage` (role-aware welcome) | `ProtectedRoute` |
| `/login` | `LoginPage` | public |
| `/register` | `RegisterPage` | public |
| `/dashboard` | `DashboardPage` | `RoleRoute allow={['seller']}` |
| `/componentes-ui` | `UiComponentsPage` (internal styleguide) | `ProtectedRoute` |
| `*` | `NotFoundPage` | public |

Rules:

- **Every page is lazy-loaded** with `lazy(() => import('./pages/XxxPage'))`. That is the only
  reason page files use a `default` export; keep the
  `// Default export required for React.lazy()` comment when adding one.
- **The Suspense boundary lives in `Layout`**, which wraps `<Outlet/>` in
  `<Suspense fallback={<Spinner/>}>`. Do not add per-route Suspense boundaries.
- **`ProtectedRoute`** redirects to `/login` when there is no token, preserving the attempted
  location in `state.from`.
- **`RoleRoute`** wraps `ProtectedRoute` and then gates on `user.role`. A disallowed role renders
  the **same 404 screen** as an unknown URL — deliberately, so the existence of the section is not
  revealed. While the user object is still being rehydrated it renders a spinner instead of
  deciding.
- **There is exactly one layout** for every route. Introducing a seller-specific layout would be a
  new architectural decision, not the current state.

### Adding a route

1. Create `app/pages/XxxPage.tsx` with a default export.
2. Add the `lazy()` import at the top of `router.tsx`.
3. Add the route entry, wrapped in `ProtectedRoute` / `RoleRoute` as needed.
4. Add the navigation entries in `Sidebar` and `MobileTabBar` if the route is user-facing.

---

## 4. Data access

Every call to the backend goes through **`lib/api-client.ts`**, which is the only place in the
codebase allowed to call `fetch`.

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
```

`request<T>()` does all of the following once, so callers never repeat it:

- injects `Content-Type: application/json` and `Authorization: Bearer <token>` when a token is set;
- converts a network failure into a typed `ApiError`;
- parses the body defensively and validates that it matches the backend envelope;
- throws `ApiError(payload.error)` when the response is not ok or `success` is `false`;
- returns `payload.data as T` on success.

The exported surface is `apiClient.get/post/put/patch/delete`.

### The response envelope

The backend always answers with the shape mirrored in `types/api.ts`, which matches
`backend/src/adapters/inbound/schemas/common.py`:

```ts
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
```

The client unwraps it, so a feature API function receives `data` directly and never inspects
`success` itself.

### Token propagation

The token is **not** read from a React context by the client. `api-client.ts` keeps a module-level
variable set through `setAuthToken(token)`, and `AuthProvider` calls it from an effect whenever the
token changes. This avoids a circular import between the provider and the client. Keep that
contract: never import React state into `lib/`.

### Feature API modules

Each feature owns `api/<feature>-api.ts`. Its job is to call `apiClient` and **map the backend DTO
to the frontend domain type** — the backend speaks `snake_case`, the frontend speaks `camelCase`,
and that translation belongs here and nowhere else:

```ts
import { apiClient } from '@/lib/api-client';

interface RawUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

const toUser = (raw: RawUser): User => ({
  id: raw.id,
  email: raw.email,
  name: raw.name,
  role: raw.role as UserRole,
});

export const getCurrentUser = async (): Promise<User> =>
  toUser(await apiClient.get<RawUser>('/auth/me'));
```

### Consuming it from a component

Never call an API function from a bare `useEffect`. Use `useApi`, which owns the
`data / isLoading / error` triple and normalises thrown `ApiError`s into a message:

```ts
const { data, isLoading, error, execute } = useApi(loginUser);
```

---

## 5. State

- **One React Context only: `AuthContext`**, declared in `features/auth/context/auth-context.ts`
  and provided by `AuthProvider`. It exposes `{ user, token, isLoading, login, logout }`.
- The context object itself is **private** — it is not re-exported from `features/auth/index.ts`.
  Consumers use the `useAuth()` hook, which throws when used outside the provider.
- **The token is persisted** in `localStorage` through `useLocalStorage('auth-token')`. The **user
  object is not persisted**: on mount, when a token exists but no user does, `AuthProvider`
  re-fetches `getCurrentUser()` and calls `logout()` if that fails, so a stale token cannot
  survive.
- Everything else is local `useState`. **Do not introduce Redux, Zustand or React Query.** If two
  features need the same state, lift it into a context inside the feature that owns the domain, or
  into a shared hook.

---

## 6. Conventions

| Item | Rule | Example |
|---|---|---|
| Component files | `PascalCase.tsx` | `BookCard.tsx` |
| Hook files | `camelCase.ts`, prefixed `use` | `useBookSearch.ts` |
| API / util / context files | `kebab-case.ts` | `books-api.ts`, `format-price.ts` |
| Exports | Named, always | `export const Button = …` |
| Default exports | Only `app/pages/*`, for `React.lazy` | `export default HomePage;` |
| Props | `interface XxxProps`, never `type` | `interface BookCardProps { … }` |
| Components | Function components with hooks | no class components |
| Tests | Colocated `Xxx.test.tsx` beside the file | `Header.test.tsx` |
| Styling | Tailwind classes in JSX only | no `.css` files besides `app/index.css` |
| Imports | `@/` alias to `src/` | `import { Button } from '@/components/ui/Button';` |

The `@/` alias is configured in both `tsconfig.json` (`paths`) and `vite.config.ts`
(`resolve.alias`); both must be kept in sync.

---

## 7. How to build a new feature

`features/auth/` is the reference implementation. Create the files in this order — the public
barrel goes last, once you know what actually needs to be public.

**1. `types/index.ts`** — the domain types, in `camelCase`.

```ts
export type UserRole = 'customer' | 'seller';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}
```

**2. `api/<feature>-api.ts`** — one function per backend operation, plus the raw→domain mapping
shown in §4. Never call `fetch` here; always `apiClient`.

**3. `context/<feature>-context.ts`** — only if the feature needs state shared across its own
components. Keep it private to the feature.

```ts
export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
```

**4. `hooks/use<Feature>.ts`** — the context consumer, which fails loudly outside its provider.

```ts
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

**5. `hooks/use<Action>.ts`** — optional thin wrappers composing `useApi` with the feature hook.

**6. `components/<Feature>Provider.tsx`** — if the feature is stateful. It owns the state, persists
what must survive a reload via `useLocalStorage`, and synchronises anything the outside world needs
(as `AuthProvider` does with `setAuthToken`).

**7. `components/*.tsx`** — the feature UI, built **exclusively** on the primitives in
`@/components/ui` (see [frontend-ui-components.md](./frontend-ui-components.md)). Every component
gets a colocated test (see [frontend-testing.md](./frontend-testing.md)).

**8. `index.ts`** — the public API. Export components, hooks and types; keep contexts, raw DTOs and
internal helpers out.

```ts
export { AuthProvider } from './components/AuthProvider';
export { LoginForm } from './components/LoginForm';
export { useAuth } from './hooks/useAuth';
export type { User, UserRole } from './types';
```

**9. Wire it into `app/`** — add the provider to `providers.tsx` if it has one, and the pages and
guards to `router.tsx`.

**10. Verify** — lint, format, typecheck and tests must all pass before committing; see
[frontend-code-style.md](./frontend-code-style.md) and [frontend-testing.md](./frontend-testing.md).

---

## 8. Checklist before opening a PR

- [ ] No feature imports another feature's internal path.
- [ ] Nothing outside `lib/api-client.ts` calls `fetch`.
- [ ] No data fetching inside a bare `useEffect`; `useApi` is used instead.
- [ ] No `any`; `unknown` plus narrowing where the type is genuinely open.
- [ ] Props typed with an `interface`; named exports everywhere except lazy pages.
- [ ] Only Tailwind classes and existing `components/ui` primitives for styling.
- [ ] New public surface exported from the feature's `index.ts`, nothing more.
- [ ] Colocated tests added; coverage stays at or above 80%.
