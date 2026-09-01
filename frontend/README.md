# BookShelf Frontend — SPA

Aplicación de página única (SPA) de la tienda de libros BookShelf, construida con **React + TypeScript** siguiendo la arquitectura **Bulletproof React**. La búsqueda está optimizada reutilizando en sesión los datos ya obtenidos, evitando peticiones redundantes al backend.

## Stack

- **React 18**
- **TypeScript** (strict mode)
- **Vite** (build + dev server)
- **TailwindCSS** (estilos)
- **React Router v6** (routing)
- **Vitest + React Testing Library** (unit testing)
- **Playwright** (E2E)
- **ESLint + Prettier** (linting + formatting)

## Arquitectura Bulletproof React

El código se organiza por **features** autónomos. Cada feature encapsula su `api/`, `components/`, `hooks/` y `types/`, y expone su contrato público a través de un `index.ts`.

```
frontend/
├── src/
│   ├── app/           # Entrypoint, providers globales y router
│   │
│   ├── features/      # MÓDULOS DE DOMINIO — cada feature es autónomo
│   │   ├── auth/      # Login, registro, ProtectedRoute, useAuth
│   │   ├── books/     # Catálogo, detalle, búsqueda
│   │   ├── wishlist/  # Favoritos
│   │   └── seller/    # Panel de vendedor
│   │       ├── api/       # Llamadas al backend
│   │       ├── components/# Componentes exclusivos del feature
│   │       ├── hooks/     # Hooks del feature
│   │       ├── types/     # Tipos TypeScript del feature
│   │       └── index.ts   # Public API (re-exports)
│   │
│   ├── components/    # COMPARTIDOS — UI genérica (ui/) y layout (layout/)
│   ├── hooks/         # Hooks genéricos: useApi, useDebounce, useLocalStorage
│   ├── lib/           # api-client.ts (instancia base de fetch con baseURL e interceptors)
│   ├── types/         # Tipos globales: ApiResponse<T>, PaginatedResponse<T>
│   └── utils/         # Helpers puros: format-price, validate-isbn
│
├── e2e/               # Tests E2E con Playwright (Page Object Model)
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── Dockerfile
```

### Reglas de la arquitectura

1. **Cada feature es un módulo autónomo** con su propia `api/`, `components/`, `hooks/`, `types/` e `index.ts`.
2. **Un feature NO importa directamente de otro feature.** Los tipos compartidos van a `types/` global o se exportan desde el `index.ts` del feature de origen.
3. **El `index.ts` de cada feature es su contrato público:** solo lo exportado ahí es accesible desde fuera.
4. **`components/` raíz es UI genérica** (Button, Input, Modal, Card, Spinner) sin lógica de negocio ni imports de features.
5. **`hooks/` raíz son hooks genéricos** (useApi, useDebounce, useLocalStorage) sin lógica de negocio.
6. **`app/` solo contiene wiring:** providers, router y el componente raíz.

## Convenciones de código

- Functional components con hooks. **No** class components.
- `PascalCase` para componentes (`BookCard.tsx`), `camelCase` para hooks (`useAuth.ts`), `kebab-case` para utilidades y API (`books-api.ts`).
- TypeScript strict. Prohibido `any` — usar `unknown` con *narrowing*.
- **Named exports** siempre (salvo páginas para lazy loading).
- Props definidas con `interface`, no con `type`.

## Estado

- **React Context** solo para auth (usuario logueado, token), en `app/providers.tsx`.
- **Estado local** (`useState`, `useReducer`) para todo lo demás. Sin Redux ni Zustand.
- **Datos del servidor** gestionados con el hook `useApi` (loading / error / data). Los datos se reutilizan en sesión para optimizar la búsqueda.
- Un estado necesario en más de un feature se eleva a Context o a un hook compartido.

## API Client

- Un único `lib/api-client.ts` con la baseURL configurable:
  ```typescript
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  ```
- Todas las llamadas al backend pasan por este client; el token JWT se inyecta automáticamente desde el `AuthContext`.
- Respuestas tipadas con generics: `ApiResponse<Book>`, `ApiResponse<Book[]>`.

## Estilos

- **TailwindCSS** para todo. Sin CSS modules, styled-components ni CSS en línea.
- Clases de Tailwind directamente en el JSX; variantes con lógica condicional.
- No se crean archivos `.css` salvo `index.css` con las directivas de Tailwind.

## Routing

- React Router v6 con rutas en `app/router.tsx`.
- Lazy loading para las páginas principales.
- Rutas protegidas con el componente `ProtectedRoute` de `features/auth`.
- Rutas de seller separadas con su propio layout.

## Path Aliases

`@/` apunta a `src/` (configurado en `tsconfig.json` y `vite.config.ts`):

```typescript
import { BookCard } from '@/features/books';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
```

## Puesta en marcha

```bash
npm install
npm run dev        # servidor de desarrollo (Vite)
npm run build      # build de producción
```

## Testing

- **Unit:** Vitest + React Testing Library. Los tests se colocan junto al componente (`BookCard.test.tsx`). Se testea comportamiento, no implementación (`getByRole`, `getByText`, no `getByTestId`).
- **E2E:** Playwright con Page Object Model.

```bash
npx vitest run --coverage   # unit + coverage
npx playwright test         # E2E
```

## Qué NO hacer

- No importar componentes internos de un feature desde fuera — solo lo que exporta su `index.ts`.
- No poner lógica de negocio en `components/` raíz.
- No usar `any` — usar `unknown` con type guards.
- No crear archivos CSS individuales — usar Tailwind.
- No usar `useEffect` para fetch de datos — usar el hook `useApi`.
- No meter estado global (Context) para datos que solo usa un feature.
- No hacer fetch directo con `window.fetch` — siempre a través de `lib/api-client.ts`.
