# react-template Frontend — SPA

Aplicación de página única (SPA) de la plantilla react-template, construida con **React + TypeScript** siguiendo la arquitectura **Bulletproof React**.

Está deliberadamente a medio construir: el feature de autenticación está completo de punta a punta y hoy es el único que existe. El dominio de ejemplo —`Item`, el recurso publicable del catálogo, y `Collection`, la agrupación editorial que lo ordena— lo levantan las issues #39 a #43 en `features/example/items/` y `features/example/collections/`. Es una plantilla, no un producto.

## Stack

- **React 18**
- **TypeScript** (strict mode)
- **Vite** (build + dev server)
- **TailwindCSS** (estilos)
- **shadcn/ui** como base de componentes — el código se copia al repositorio, no es una dependencia
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
│   │   └── auth/      # El único que existe: login, registro, ProtectedRoute, useAuth
│   │       ├── api/       # Llamadas al backend
│   │       ├── components/# Componentes exclusivos del feature
│   │       ├── hooks/     # Hooks del feature
│   │       ├── types/     # Tipos TypeScript del feature
│   │       └── index.ts   # Public API (re-exports)
│   │
│   ├── components/    # COMPARTIDOS — UI genérica (ui/, shadcn/ui) y layout (layout/)
│   ├── hooks/         # Hooks genéricos: useApi, useDebounce, useLocalStorage
│   ├── lib/           # api-client.ts (fetch con baseURL e interceptors) y utils.ts (`cn`)
│   ├── types/         # Tipos globales: ApiResponse<T>, PaginatedResponse<T>
│   └── utils/         # Helpers puros: get-initials
│
├── e2e/               # Tests E2E con Playwright (Page Object Model)
├── package.json
├── vite.config.ts
├── playwright.config.ts
├── tailwind.config.ts
├── nginx.conf         # Lo usa la imagen de produccion
└── Dockerfile
```

Lo que no aparece en el árbol todavía no existe: `features/` solo contiene `auth/`, y los features
del catálogo de ejemplo (`items/` y `collections/`) los añaden las issues #39 a #43.

### Reglas de la arquitectura

1. **Cada feature es un módulo autónomo** con su propia `api/`, `components/`, `hooks/`, `types/` e `index.ts`.
2. **Un feature NO importa directamente de otro feature.** Los tipos compartidos van a `types/` global o se exportan desde el `index.ts` del feature de origen.
3. **El `index.ts` de cada feature es su contrato público:** solo lo exportado ahí es accesible desde fuera.
4. **`components/` raíz es UI genérica** (Button, Input, Modal, Card, Spinner) sin lógica de negocio ni imports de features.
5. **`hooks/` raíz son hooks genéricos** (useApi, useDebounce, useLocalStorage) sin lógica de negocio.
6. **`app/` solo contiene wiring:** providers, router y el componente raíz.

## Convenciones de código

- Functional components con hooks. **No** class components.
- `PascalCase` para componentes (`LoginForm.tsx`), `camelCase` para hooks (`useAuth.ts`), `kebab-case` para utilidades y API (`auth-api.ts`).
- TypeScript strict. Prohibido `any` — usar `unknown` con _narrowing_.
- **Named exports** siempre (salvo páginas para lazy loading).
- Props definidas con `interface`, no con `type`.

## Estado

- **React Context** solo para auth (usuario logueado, token), en `app/providers.tsx`.
- **Estado local** (`useState`, `useReducer`) para todo lo demás. Sin Redux ni Zustand.
- **Datos del servidor** gestionados con el hook `useApi` (loading / error / data).
- Un estado necesario en más de un feature se eleva a Context o a un hook compartido.

## API Client

- Un único `lib/api-client.ts` con la baseURL configurable:
  ```typescript
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  ```
- Todas las llamadas al backend pasan por este client; el token JWT se inyecta automáticamente desde el `AuthContext`.
- Respuestas tipadas con generics: `ApiResponse<Item>`, `ApiResponse<Item[]>`.

## Estilos

- **TailwindCSS** para todo. Sin CSS modules, styled-components ni CSS en línea.
- Clases de Tailwind directamente en el JSX; las variantes de un componente se declaran con `cva` y
  las clases se componen con el helper `cn` de `lib/utils.ts`.
- Los iconos vienen de **`lucide-react`**. No se escriben SVG a mano.
- No se crean archivos `.css` salvo `index.css` con las directivas de Tailwind.

### El punto único de configuración

**Para reteñir la plantilla entera se edita un solo bloque: el `:root` de `src/app/index.css`.** Ahí
viven todas las variables CSS del proyecto — los cinco tonos de verde, los neutros (`ink`, `body`,
`muted`, `border`, `bg`, `surface`), los tres de destructivo, las dos familias tipográficas (Lora
para titulares, Public Sans para el resto), los radios y las sombras.

Eso funciona porque se cumplen dos reglas, y las dos importan:

1. **`tailwind.config.ts` no contiene ni un valor.** Cada entrada es un `var(--…)` que apunta a
   `index.css`. Si escribes un hexadecimal, un tamaño o una familia tipográfica ahí, acabas de crear
   un segundo sitio que hay que mantener sincronizado a mano.
2. **Ningún componente escribe un color.** Ni hexadecimales, ni `rgb()`, ni clases de la paleta por
   defecto de Tailwind (`slate-*`, `zinc-*`, `gray-*`, `blue-*`…), ni valores arbitrarios entre
   corchetes. Solo las clases de token: `bg-primary`, `text-ink`, `text-muted`, `border-border`,
   `bg-surface`, `text-danger`…

Los componentes que vienen de shadcn/ui esperan sus propios nombres de variable (`--background`,
`--foreground`, `--destructive`, `--ring`…). Están declarados **en ese mismo bloque como alias** de
los tokens del proyecto: no llevan ningún valor propio, así que no hay una segunda paleta que
mantener. Para cambiar un color se edita el token, nunca el alias.

Comprobarlo es mecánico: cambia los cinco `--color-primary*` por otro color, `npm run build`, y
busca los hexadecimales viejos en `dist/`. Cero resultados significa que la propiedad sigue en pie.

## El catálogo `/components-ui`

La ruta **`/components-ui`** (`src/app/pages/UiComponentsPage.tsx`, enlazada desde el grupo
«Desarrollo» de la barra lateral) muestra todos los componentes del sistema de diseño con sus
estados reales: deshabilitado, cargando, con error, vacío. Es el mejor sitio para ver de una vez qué
sabe dibujar la plantilla, y es donde se comprueba a ojo un cambio de paleta.

Es además **vinculante**: ninguna pantalla usa un componente que no esté en esa página. Si falta
uno, el procedimiento es sacarlo de la documentación de shadcn/ui, adaptarlo a los tokens y al
estilo del proyecto, añadirlo a `/components-ui` con sus estados, escribir su test y solo entonces
usarlo. Los detalles están en
[`docs/frontend-ui-components.md`](../docs/frontend-ui-components.md).

## Routing

- React Router v6 con rutas en `app/router.tsx`.
- Lazy loading para las páginas principales.
- Rutas protegidas con el componente `ProtectedRoute` de `features/auth`.
- Rutas restringidas por rol con `RoleRoute`, que exige sesión **y** rol (`allow={['admin']}`).
  Ninguna ruta lo usa todavía: `router.tsx` solo protege `/`, con `ProtectedRoute`. Hay un único
  `Layout`: el rol condiciona el acceso a una ruta, no le da un layout propio.

## Path Aliases

`@/` apunta a `src/` (configurado en `tsconfig.json` y `vite.config.ts`):

```typescript
import { useAuth } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { useApi } from '@/hooks/useApi';
```

## Puesta en marcha

Desde la raíz del monorepo, `make setup` instala también las dependencias de este proyecto y
`make dev-front` arranca el servidor de desarrollo. Dentro de `frontend/`:

```bash
npm install
npm run dev        # servidor de desarrollo (Vite, puerto 3000)
npm run build      # build de producción
```

## Testing

- **Unit:** Vitest + React Testing Library. Los tests se colocan junto al componente (`Button.test.tsx`). Se testea comportamiento, no implementación (`getByRole`, `getByText`, no `getByTestId`).
- **E2E:** Playwright con Page Object Model, en `e2e/` (`e2e/tests/` los specs, `e2e/page-objects/` las páginas).

```bash
npx vitest run --coverage   # unit + coverage
npm run test:e2e            # E2E (equivalente a `make test-e2e` desde la raíz)
```

### Requisitos para los tests E2E

Los tests E2E asumen un entorno completo levantado, no solo el frontend:

1. `make dev` — levanta PostgreSQL en Docker.
2. `make dev-back` — API en `http://localhost:8000` (en otra terminal).
3. `make seed` — puebla la base de datos, incluidas dos cuentas fijas (una
   `editor` y otra `viewer`) pensadas para el login manual y para los propios
   specs. Sus credenciales literales viven en `backend/seed.py`, que es su única
   fuente de verdad, y el spec de login las repite en `e2e/tests/auth.spec.ts`.
   Son datos de desarrollo únicamente — nunca credenciales válidas fuera de una
   base de datos local.

Playwright arranca el propio `npm run dev` (puerto 3000) a través de `webServer`
en `playwright.config.ts`, así que no hace falta tenerlo corriendo aparte.

## Qué NO hacer

- No importar componentes internos de un feature desde fuera — solo lo que exporta su `index.ts`.
- No poner lógica de negocio en `components/` raíz.
- No usar `any` — usar `unknown` con type guards.
- No crear archivos CSS individuales — usar Tailwind.
- No escribir un color en un componente ni un valor en `tailwind.config.ts` — la paleta vive en el `:root` de `app/index.css` y en ningún otro sitio.
- No usar en una pantalla un componente que no esté en `/components-ui`.
- No ejecutar `shadcn init` — reescribe `index.css` y `tailwind.config.ts` con sus propios tokens.
- No usar `useEffect` para fetch de datos — usar el hook `useApi`.
- No meter estado global (Context) para datos que solo usa un feature.
- No hacer fetch directo con `window.fetch` — siempre a través de `lib/api-client.ts`.
