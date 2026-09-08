# react-fastapi-template — Tienda de libros online

react-fastapi-template es una **plantilla de proyecto** full-stack. Usa una tienda de libros como dominio de ejemplo, con la autenticación resuelta de punta a punta y el resto del catálogo deliberadamente a medio hacer: lo que se lleva de aquí es la arquitectura, las convenciones y el andamiaje, no la tienda.

Es un **monorepo** con el backend y el frontend juntos, pensado como proyecto de formación en Claude Code y desarrollo agéntico. Aunque ambos conviven en el mismo repositorio, se **despliegan por separado**.

## Funcionalidades

El dominio de ejemplo es una librería, y está deliberadamente a medio construir: la plantilla existe
para enseñar la arquitectura, no para vender libros. Esto es lo que hay hoy, sin adornos.

**Completo, de punta a punta:**

- **Registro e inicio de sesión** — alta de cuenta y autenticación con JWT, con la sesión persistida
  en el cliente y restaurada al recargar.
- **Roles diferenciados** — `seller` y `customer`, con rutas de la SPA protegidas por rol.
- **Logging estructurado** — cada petición emite un evento con `request_id`, `status_code` y
  `duration_ms`, correlacionable desde la cabecera `X-Request-ID` de la respuesta.

**Solo en la API, sin pantalla todavía:**

- **Catálogo y búsqueda** — `GET /books` y `GET /books/search` funcionan; la búsqueda es un `ILIKE`
  sobre título y autor. La SPA aún no tiene pantalla de catálogo.
- **Listas de favoritos** — CRUD completo en la API. El módulo `wishlist/` del frontend está vacío.

Lo que **no** existe —carrito, compra, histórico de pedidos, recomendaciones con IA— vive en el
[Roadmap](#roadmap), no aquí. Si has llegado desde «Use this template», eso es precisamente lo que
te toca construir.

## Estructura del repositorio

```
react-fastapi-template/
├── backend/          # API REST — Python 3.12, FastAPI, Arquitectura Hexagonal
├── frontend/         # SPA — React 18, TypeScript, Bulletproof React Architecture
├── infra/            # Docker Compose — PostgreSQL 16 (dev) + stack de produccion
├── .claude/          # Subagentes y slash commands
├── .github/          # GitHub Actions workflows
└── Makefile          # Comandos unificados del proyecto
```

Cada subdirectorio (`backend/`, `frontend/`) tiene su propio `README.md` y `CLAUDE.md` con las convenciones específicas de su stack. Este documento recoge únicamente la información global compartida.

## Stack tecnológico

| Capa        | Tecnologías                                                              |
| ----------- | ------------------------------------------------------------------------ |
| Frontend    | React 18, TypeScript, Vite, TailwindCSS, React Router v6                 |
| Backend     | Python 3.12, FastAPI (async), SQLAlchemy 2.0, Alembic                    |
| Base de datos | PostgreSQL 16                                                          |
| Testing     | pytest / Vitest / Playwright (E2E)                                       |
| Infra       | Docker Compose                                                           |
| CI/CD       | GitHub Actions                                                           |

Los dos proyectos son **independientes** y se comunican exclusivamente a través de la **API REST**; nunca comparten código directamente.

## Puesta en marcha

Requisitos: **Python 3.12+**, **Node.js 20+**, **Docker** y **Docker Compose**.

### Getting started (un solo comando)

```bash
make setup
```

`make setup` deja la máquina lista para desarrollar y es **idempotente** (se puede relanzar sin miedo). Hace, en este orden:

1. Crea el `.env` a partir de `.env.example` si no existe.
2. Crea el entorno virtual en `.venv/` (raíz del monorepo) si no existe.
3. Instala el backend en modo editable con sus extras de desarrollo (`pip install -e "backend[dev]"`).
4. Instala las dependencias npm del frontend.
5. Engancha los hooks de `pre-commit` en `.git/hooks/pre-commit`.
6. Levanta PostgreSQL en Docker, aplica las migraciones de Alembic y carga los datos de ejemplo.

Si Docker no está arrancado, el paso 6 se salta con un aviso y el resto se completa igual; luego basta con `make dev && make migrate && make seed`.

Variantes: `make setup ARGS="--skip-db"`, `ARGS="--skip-front"`, `ARGS="--no-seed"`.

#### Credenciales de desarrollo

El seed crea dos cuentas de email fijo, pensadas para entrar a mano y para los tests e2e:

| Email                    | Rol        | Contraseña      |
| ------------------------ | ---------- | --------------- |
| `seller@bookshelf.dev`   | `seller`   | `BookShelf123!` |
| `customer@bookshelf.dev` | `customer` | `BookShelf123!` |

El resto de usuarios sembrados los genera Faker con semilla fija. Estas dos son literales
precisamente para que no cambien al actualizar la librería.

> Son **datos de desarrollo**, nunca credenciales válidas fuera de una base de datos local. No las
> reutilices en ningún entorno real.

### Desarrollo del día a día

Docker se usa solo para la **base de datos**: backend y frontend se ejecutan **en el host**, cada uno con su propio hot reload, contra la PostgreSQL del contenedor. Tres terminales:

```bash
make dev         # PostgreSQL 16 en Docker, en background
make dev-back    # API      → http://localhost:8000/docs
make dev-front   # SPA      → http://localhost:3000
```

Los targets del Makefile llaman al intérprete de `.venv` por ruta, así que **no hace falta activar el entorno virtual**. Para lanzar comandos a mano sí conviene: `.venv\Scripts\Activate.ps1` (Windows) o `source .venv/bin/activate` (Linux/macOS).

### Stack de producción

Para ver la aplicación funcionando tal y como se despliega, sin hot reload ni código montado por volúmenes:

```bash
cp .env.example .env
make prod
```

Construye y levanta las tres imágenes (PostgreSQL + backend + frontend) con el perfil `prod` de Compose: la SPA en <http://localhost:3000> y la API en <http://localhost:8000>, ambas corriendo como usuario no root. Es la prueba de humo antes de publicar, no el entorno de trabajo diario.

Igual que `make dev`, arranca en **background** y no vuelca los logs de los contenedores en la terminal. Para verlos: `cd infra && docker compose --env-file ../.env --profile prod logs -f`.

### Parar los contenedores

El Makefile no tiene target para parar; se hace desde `infra/`:

```bash
cd infra
docker compose --env-file ../.env --profile prod down      # datos intactos
docker compose --env-file ../.env --profile prod down -v   # borra también el volumen
```

El `--profile prod` es **imprescindible**: sin él, `down` deja en marcha los servicios que pertenecen a un perfil.

## Comandos (Makefile)

Todos los comandos se ejecutan desde la raíz del monorepo:

| Comando              | Descripción                                     |
| -------------------- | ----------------------------------------------- |
| `make help`          | Lista los comandos disponibles (target por defecto) |
| `make setup`         | Getting started: entorno local listo para trabajar |
| `make dev-back`      | Backend en el host con hot reload (puerto 8000)  |
| `make dev-front`     | Frontend en el host con hot reload (puerto 3000) |
| `make dev`           | Solo PostgreSQL en Docker, en background        |
| `make prod`          | Stack completo con las imágenes de producción   |
| `make install-hooks` | Instala deps de npm del frontend + hooks de git |
| `make test`       | Tests de backend (pytest) + frontend (vitest)   |
| `make test-back`  | Solo tests del backend (pytest)                 |
| `make test-front` | Solo tests del frontend (vitest)                |
| `make test-e2e`   | Tests E2E con Playwright (requiere API y seed)  |
| `make lint`       | Linters de backend + frontend                   |
| `make lint-front` | Solo ESLint del frontend                        |
| `make format-front` | Reformatea el frontend con Prettier           |
| `make migrate`    | `alembic upgrade head`                          |
| `make seed`       | Script de seed de datos                          |
| `make build`      | Build de las imágenes Docker de ambos proyectos |

## Convenciones globales

- **Idioma del código:** inglés (variables, funciones, clases, comentarios).
- **Idioma de la documentación, según a quién va dirigida:** **español** para lo
  que leen personas — los cuatro `README.md` y los ADR de `backend/docs/`—, e
  **inglés** para lo que leen los agentes — `CLAUDE.md`, `docs/` y `.claude/`.
  Los textos de la interfaz, en español.
- **Tipado estricto obligatorio** en ambos stacks (mypy strict / TypeScript strict).
- Todo el código debe tener tests. **Coverage mínimo: 80 %**, aplicado
  automáticamente en el backend desde `[tool.coverage.report] fail_under`
  en `backend/pyproject.toml`: `pytest --cov=src` falla si se baja del umbral.

## Git

- **Conventional commits** obligatorios: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`.
- El scope indica el módulo: `feat(backend): add book search endpoint`, `fix(frontend): fix login redirect`.

### Hooks de pre-commit

`make setup` ya los instala. Si solo quieres esa parte (sin entorno virtual ni base de datos):

```bash
make install-hooks
```

Instala las dependencias npm del frontend y engancha `pre-commit` en `.git/hooks/pre-commit`.
A partir de ahí, cada `git commit` ejecuta automáticamente:

| Hook                | Se dispara cuando cambian | Qué hace                                       |
| ------------------- | ------------------------- | ---------------------------------------------- |
| `ruff-check`        | `backend/`                | Lint de Python con autofix                     |
| `ruff-format`       | `backend/`                | Formato de Python                              |
| `mypy`              | `backend/src/`            | Tipado estricto                                |
| `eslint (frontend)` | `frontend/src/*.ts(x)`    | `npm run lint` — falla con cualquier warning   |
| `prettier (frontend)` | `frontend/`             | `npm run format:check`                         |

Si Prettier se queja, `make format-front` lo arregla. Los hooks del frontend usan el ESLint y
el Prettier de `frontend/node_modules`, así que las dependencias tienen que estar instaladas.

## Docker

- `infra/docker-compose.yml` levanta el entorno completo.
- Servicios: PostgreSQL 16, backend FastAPI y frontend Vite.
- Dockerfiles multi-stage en cada subdirectorio (`backend/Dockerfile`, `frontend/Dockerfile`).

## Configuración y secretos

- Variables de entorno en `.env` (no versionado).
- `.env.example` versionado con todas las variables necesarias y valores de ejemplo.
- Nunca se hardcodean secrets, URLs de base de datos, API keys ni tokens en el código.

## CI/CD

GitHub Actions en `.github/workflows/`. El pipeline se construye por
incrementos: hoy existen **dos workflows**, uno por stack, cada uno con su
filtro de rutas para que una PR que solo toca el frontend no ejecute los tests
del backend.

| Workflow | Jobs | Se dispara con |
|---|---|---|
| `ci-backend.yml` | `lint` → `test-backend` | cambios en `backend/**` |
| `ci-frontend.yml` | `lint` → `test-frontend` | cambios en `frontend/**` |

- `lint` (backend): `ruff check`, `ruff format --check`, `mypy --strict`.
- `test-backend`: PostgreSQL 16 como `service`, `alembic upgrade head` y
  `pytest --cov=src`.
- `lint` (frontend): `eslint`, `prettier --check`, `tsc --noEmit`.
- `test-frontend`: `vitest` con cobertura.

*Quality gate*: linters, tipado estricto y umbrales de coverage. Los umbrales
viven en la configuración de cada proyecto (`backend/pyproject.toml`
→ `[tool.coverage.report] fail_under = 80`; `frontend/vite.config.ts`
→ `coverage.thresholds`), nunca en el YAML: así el mismo comando falla
igual en local y en CI.

Los tests E2E existen (`make test-e2e`) pero **no corren en CI**: necesitan la
API levantada y la base sembrada, así que de momento son un target manual.
Las fases `build` y `security-scan` todavía no existen. Cada pendiente llega en
su propia issue:

| Fase pendiente | Issue |
|---|---|
| E2E dentro del pipeline | #33 |
| Escaneo de seguridad (CodeQL, gitleaks, Trivy) | #21 |
| Build de imágenes Docker y publicación en GHCR | #22 |
| Branch protection y checks obligatorios | #23 |

## Roadmap

Extensiones que la plantilla **no** trae de serie y que se dejan documentadas
como punto de enganche, no como deuda:

- **Búsqueda semántica con `pgvector`.** La plantilla arranca con `postgres:16`
  a secas: la extensión estaba declarada pero ningún modelo, migración ni
  repositorio la usaba, así que solo añadía peso a la imagen y a las
  dependencias. Para recuperarla harían falta cuatro piezas: la imagen
  `pgvector/pgvector:pg16` en `infra/docker-compose.yml` con un
  `CREATE EXTENSION vector` de inicialización, el paquete `pgvector` en las
  dependencias de `backend/pyproject.toml`, una migración de Alembic que añada
  la columna de embeddings, y un adaptador de salida bajo
  `backend/src/adapters/outbound/` que calcule los embeddings detrás de un
  puerto del dominio. La búsqueda actual (`/books/search`) es un `ILIKE` y
  seguiría siendo el fallback.

- **Compra, carrito e histórico de pedidos.** Nunca han existido: no hay modelo
  de dominio, ni router, ni migración. El README los anunciaba en presente y
  eso se ha corregido. Construirlos es, de hecho, un buen primer ejercicio
  sobre la plantilla: una entidad nueva recorre las tres capas y `docs/backend-hexagonal-architecture.md`
  lleva el paso a paso.

- **Recomendaciones con IA.** Cayeron con `pgvector`, por el mismo motivo.
  `backend/docs/decision-stack-backend.md` conserva el razonamiento original y
  explica por qué la decisión de stack se sostiene igual sin ellas.

- **Pantallas de catálogo y de favoritos.** La API existe y está probada
  (`GET /books`, `/books/search` y el CRUD de listas de favoritos); lo que falta
  es el frontend. Los módulos `frontend/src/features/books/` y `wishlist/` están
  creados y vacíos, con su `index.ts` exportando nada, listos para llenarse.

## Despliegue

El frontend y el backend se desarrollan juntos en este repositorio pero se **despliegan de forma independiente**, de modo que cada parte puede escalar y publicarse según su propio calendario.

## Licencia

Publicado bajo licencia [MIT](LICENSE). Puedes usar, copiar, modificar,
fusionar, publicar y redistribuir el código libremente, incluso en obras
derivadas de licencia distinta, siempre que conserves el aviso de copyright
y de la licencia.

### Aviso: no apto para producción

Como se indica arriba, esto es un ejercicio de aprendizaje: no es un producto,
no tiene mantenimiento comprometido y **no está pensado para usarse en
producción**. En concreto:

- **Sin auditoría de seguridad.** La autenticación, la gestión de sesiones y el
  control de acceso están implementados con fines didácticos y no han pasado
  ninguna revisión de seguridad formal.
- **Configuración orientada a desarrollo.** El entorno de `infra/` y el fichero
  `.env.example` traen valores pensados para levantar el proyecto en local. Si
  aun así lo despliegas, sustituye toda la configuración sensible por valores
  propios y gestionados fuera del repositorio.
- **Datos ficticios.** El catálogo, los usuarios y los pedidos que genera el
  script de seed son datos sintéticos creados con Faker. No corresponden a
  personas, libros ni transacciones reales.
- **Sin estabilidad de API ni de esquema.** Los endpoints, los modelos de datos
  y las migraciones pueden cambiar de forma incompatible en cualquier momento,
  sin aviso ni ruta de migración.
- **Sin soporte.** Los issues y las pull requests forman parte del ejercicio de
  formación; no hay ningún compromiso de respuesta ni de corrección de fallos.

Usarlo es cosa tuya y **bajo tu entera responsabilidad**, tal y como recoge la
cláusula de exención de garantías de la licencia. Si buscas una base para un
sistema real, trátalo como material de referencia y no como código listo para
desplegar.

> **Training project — not for production use.** react-fastapi-template is a learning
> exercise. It has not been security-audited, ships development-oriented
> configuration and synthetic seed data, offers no API or schema stability and
> no support. Use it as a reference, at your own risk, under the MIT license terms.

### Dependencias de terceros

Las librerías que usa el proyecto (entre otras FastAPI, SQLAlchemy, React y
TailwindCSS) se distribuyen bajo sus propias licencias. La licencia MIT de
este repositorio cubre únicamente el código original de react-fastapi-template.
