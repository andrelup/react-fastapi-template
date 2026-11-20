# react-fastapi-template — Plantilla full-stack

react-fastapi-template es una **plantilla de proyecto** full-stack. Usa un catálogo genérico (artículos, colecciones y etiquetas) como dominio de ejemplo, con la autenticación resuelta de punta a punta y el catálogo deliberadamente a medio hacer: lo que se lleva de aquí es la arquitectura, las convenciones y el andamiaje, no el dominio.

Es un **monorepo** con el backend y el frontend juntos, pensado como proyecto de formación en Claude Code y desarrollo agéntico. Aunque ambos conviven en el mismo repositorio, se **despliegan por separado**.

## Funcionalidades

El dominio de ejemplo es un catálogo genérico, y está deliberadamente a medio construir: la plantilla
existe para enseñar la arquitectura, no para resolver un negocio concreto. Esto es lo que hay hoy,
sin adornos.

**Completo, de punta a punta:**

- **Registro e inicio de sesión** — alta de cuenta y autenticación con JWT, con la sesión persistida
  en el cliente y restaurada al recargar.
- **Roles diferenciados** — `admin`, `editor` y `viewer`, jerárquicos, con rutas de la SPA
  protegidas por rol. Son una **simulación del mecanismo**, no un modelo de permisos: el registro es
  abierto y acepta el rol que le mandes, porque cerrar esa puerta se puede hacer de cinco maneras
  razonables y cuál es la buena depende del proyecto. Decidirlo es lo primero que le toca a quien
  use la plantilla; el porqué y las alternativas están en
  [0003-roles-y-registro-abierto.md](./docs/adr/0003-roles-y-registro-abierto.md).
- **Logging estructurado** — cada petición emite un evento con `request_id`, `status_code` y
  `duration_ms`, correlacionable desde la cabecera `X-Request-ID` de la respuesta.

**Cimientos puestos, vertical por construir:**

- **Esquema del catálogo de ejemplo** — las tablas `items` (con su dueño), `collections`,
  `tags` y sus tablas de asociación existen, con bloqueo optimista y sus migraciones de Alembic. Sus modelos ORM viven aislados en
  `backend/src/adapters/outbound/persistence/example/`, para que borrar el dominio de ejemplo de un
  proyecto generado sea un `rm -rf` de ese directorio.

Lo que **no** existe —el dominio, los repositorios, la API y las pantallas del catálogo— vive en el
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

Requisitos: **Python 3.12+**, **Node.js 24** (la versión mayor de `frontend/.nvmrc`), **Docker** y **Docker Compose**.

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

`make seed` (`backend/seed.py`) crea cuatro cuentas fijas, una por rol y una segunda `EDITOR`,
todas con la contraseña `ChangeMe123!`:

| Email                   | Rol      |
|-------------------------|----------|
| `admin@example.com`     | `ADMIN`  |
| `editor@example.com`    | `EDITOR` |
| `editor2@example.com`   | `EDITOR` |
| `viewer@example.com`    | `VIEWER` |

El seed está partido en dos ficheros siguiendo la convención `example/` del repo:
`backend/seed.py` siembra las cuentas (plantilla, sobrevive a `--no-example`) y
`backend/seed_example.py` siembra el catálogo de ejemplo —items, colecciones y etiquetas—, con
items propios para cada `EDITOR` (incluido el segundo, para poder probar que uno no edita los del
otro). El resto de usuarios y el catálogo los genera Faker con semilla fija; las cuatro cuentas por
rol son literales precisamente para que no cambien al actualizar la librería.

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

### Stack de producción en local

Para ver la aplicación funcionando con las imágenes que se desplegarían, sin hot reload ni código montado por volúmenes:

```bash
cp .env.example .env
make preview
```

Construye y levanta en local las tres imágenes (PostgreSQL + backend + frontend) con el perfil `prod` de Compose y los valores del `.env`: la SPA en <http://localhost:3000> y la API en <http://localhost:8000>, ambas corriendo como usuario no root. Es una prueba de humo, no el entorno de trabajo diario, y no despliega nada.

Igual que `make dev`, arranca en **background** y no vuelca los logs de los contenedores en la terminal. Para verlos: `cd infra && docker compose --env-file ../.env --profile prod logs -f`.

### Parar los contenedores

El Makefile no tiene target para parar; se hace desde `infra/`:

```bash
cd infra
docker compose --env-file ../.env --profile prod down      # datos intactos
docker compose --env-file ../.env --profile prod down -v   # borra también el volumen
```

El `--profile prod` es **imprescindible**: sin él, `down` deja en marcha los servicios que pertenecen a un perfil.

### Entornos

Toda URL o dirección que necesita la plataforma —la URL de la API, los orígenes CORS, y el host y el puerto de la base de datos— vive en el `.env` de cada entorno. El código no trae valores por defecto: si falta alguna, el backend, Vite y Docker Compose se niegan a arrancar con un mensaje que dice cuál falta, en lugar de apuntar a `localhost` en silencio. En `.env.example` van marcadas como `OBLIGATORIA`.

- **Local:** `.env`, creado desde `.env.example` por `make setup`. Si tu `.env` es anterior a una clave nueva, `make setup` te avisa de las que le faltan.
- **Staging y producción:** `.env.staging` y `.env.prod`, creados también desde `.env.example`. Nunca se versionan. No se usa `.env.production` porque Vite lo cargaría por su cuenta en cada build.
- **CI:** no lee el `.env` de nadie. Sus valores, todos de mentira, salen de un secret de GitHub Actions que el mantenedor crea a mano.

`make build ENV=staging` (o `ENV=prod`) construye las imágenes con los valores de ese fichero y las etiqueta como `:staging` (o `:prod`), para que no pisen las de otro entorno. Sirve para comprobar que el build funciona con esos valores; **esas imágenes no se arrancan en local**, porque el navegador llamaría a la API de ese entorno y su CORS rechazaría las peticiones. `make dev` y `make preview` usan siempre el `.env`.

**Ningún comando de `make` despliega ni publica imágenes:** todos prueban o ejecutan la plataforma en tu equipo. Desplegar será trabajo de CI cuando un proyecto creado desde esta plantilla salga a internet.

## Comandos (Makefile)

Todos los comandos se ejecutan desde la raíz del monorepo y solo prueban o ejecutan la plataforma en local; ninguno despliega:

| Comando              | Descripción                                     |
| -------------------- | ----------------------------------------------- |
| `make help`          | Lista los comandos disponibles (target por defecto) |
| `make setup`         | Getting started: entorno local listo para trabajar |
| `make dev-back`      | Backend en el host con hot reload (puerto 8000)  |
| `make dev-front`     | Frontend en el host con hot reload (puerto 3000) |
| `make dev`           | Solo PostgreSQL en Docker, en background        |
| `make preview`       | Stack completo en local con las imágenes de producción (prueba de humo) |
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
| `make build`      | Build de las imágenes Docker de ambos proyectos, sin arrancarlas; `ENV=staging` usa el `.env.staging` |

## Convenciones globales

- **Idioma del código:** inglés (variables, funciones, clases, comentarios).
- **Idioma de la documentación, según a quién va dirigida:** **español** para lo
  que leen personas — los cuatro `README.md`, los ADR de `docs/adr/` y la guía
  de `backend/docs/`—, e **inglés** para lo que leen los agentes — `CLAUDE.md`,
  el resto de `docs/` y `.claude/`.
  Los textos de la interfaz, en español.
- **Tipado estricto obligatorio** en ambos stacks (mypy strict / TypeScript strict).
- Todo el código debe tener tests. **Coverage mínimo: 80 %**, aplicado
  automáticamente en el backend desde `[tool.coverage.report] fail_under`
  en `backend/pyproject.toml`: `pytest --cov=src` falla si se baja del umbral.

## Git

- **Conventional commits** obligatorios: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`.
- El scope indica el módulo: `feat(backend): add the item search endpoint`, `fix(frontend): fix login redirect`.

### Hooks de pre-commit

`make setup` ya los instala. Si ya tienes el `.venv` y solo quieres esa parte (sin base de datos):

```bash
make install-hooks
```

Instala las dependencias npm del frontend y engancha `pre-commit` en `.git/hooks/pre-commit`.
A partir de ahí, cada `git commit` ejecuta automáticamente:

| Hook                  | Se dispara cuando cambian                         | Qué hace                                      |
| --------------------- | ------------------------------------------------- | --------------------------------------------- |
| `ruff-check`          | un `.py` de `backend/`                            | Lint de Python con autofix                    |
| `ruff-format`         | un `.py` de `backend/`                            | Formato de Python                             |
| `mypy`                | un `.py` de `backend/` o `backend/pyproject.toml` | Tipado estricto de todo `backend/`, igual que CI |
| `eslint (frontend)`   | `frontend/src/*.ts(x)`                            | `npm run lint` — falla con cualquier warning  |
| `prettier (frontend)` | `frontend/`                                       | `npm run format:check`                        |

Los hooks usan las herramientas ya instaladas en el proyecto: los del backend, el ruff y el mypy
del `.venv`; los del frontend, el ESLint y el Prettier de `frontend/node_modules`. Por eso las
versiones solo se declaran en `backend/pyproject.toml` y `frontend/package.json`: para añadir o
subir una librería basta con cambiarla ahí y reinstalar (`pip install -e ".[dev]"` desde
`backend/`, o `npm ci` desde `frontend/`). Hasta reinstalar, el hook sigue usando las versiones
anteriores. Ver `docs/adr/0007-versiones-de-ruff-y-mypy-en-pre-commit.md`.

Si Prettier se queja, `make format-front` lo arregla.

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
incrementos: hoy existen **tres workflows**. Los dos primeros son uno por stack,
cada uno con su filtro de rutas para que una PR que solo toca el frontend no
ejecute los tests del backend; el tercero es el de seguridad y no lleva filtro.

| Workflow | Jobs | Se dispara con |
|---|---|---|
| `ci-backend.yml` | `lint` → `test-backend` | cambios en `backend/**` |
| `ci-frontend.yml` | `lint` → `test-frontend` | cambios en `frontend/**` |
| `security.yml` | `codeql` → `codeql-gate`, `gitleaks`, `trivy` | toda PR y todo push a `main`, y el día 1 de cada mes |

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
Las imágenes no se publican en ningún registro: nada las despliega.
La fase pendiente llega en su propia issue:

| Fase pendiente | Issue |
|---|---|
| E2E dentro del pipeline | #33 |

### Fase `security-scan`

`security.yml` no lleva filtro de rutas: un secreto o un patrón vulnerable puede
aparecer en cualquier fichero. Sus jobs son independientes y todo lo que
encuentran acaba como SARIF en la pestaña *Security* del repositorio:

- `codeql`: análisis estático de `python` y `javascript-typescript`.
- `codeql-gate`: corre después de `codeql` y falla si quedan alertas abiertas de
  CodeQL con severidad crítica o alta en la ref analizada. Sin él, un hallazgo
  en un push a `main` o en la ejecución programada no pondría nada en rojo.
  Descartar la alerta (*dismiss*) en la pestaña *Security* es la forma de
  aceptar un falso positivo.
- `gitleaks`: busca secretos en todo el histórico de git, con el valor
  censurado (`--redact`) en el log y en el SARIF.
- `trivy`: construye las dos imágenes (`docker build`, sin publicarlas) y
  escanea el sistema de ficheros y las dos imágenes. Es el único sitio de CI que
  comprueba que los `Dockerfile` construyen, así que uno roto sale en rojo.
  `backend/` no tiene lockfile: las dependencias de Python solo se ven al
  escanear su imagen.

Las acciones de terceros van fijadas por SHA de commit, y el binario de Trivy
por versión: `trivy-action` fue comprometida en marzo de 2026
(GHSA-69fq-xp46-6x23). Un hallazgo se corrige; no se oculta con un
`.trivyignore` sin aprobación.

**Ejecución programada.** Corre el día 1 de cada mes a las 06:17 UTC, para que
aparezcan las vulnerabilidades nuevas aunque no haya commits. En un repositorio
público GitHub desactiva los workflows programados tras 60 días sin actividad, y
la propia ejecución programada no cuenta como actividad: si el repo pasa dos
meses sin commits, el escaneo corre un par de veces y se apaga. GitHub suele
avisar por email antes; se reactiva desde la pestaña *Actions* o con
`gh workflow enable security.yml`.

**Avisos cuando falla.** No es código del repo sino configuración de la cuenta:
GitHub notifica los fallos de un workflow programado a quien editó por última
vez su línea `cron`.

- Email: *Settings → Notifications → System → Actions*, con email activado y
  «Only notify for failed workflows».
- Móvil: app GitHub Mobile, *Settings → Configure Notifications*, notificaciones
  push de Actions solo para los fallos.

## Roadmap

Piezas del dominio de ejemplo que la plantilla deja a medias a propósito. No son
deuda técnica: son el trabajo que se espera que hagas tú al partir de aquí.

- **Una entidad tuya, de punta a punta.** Es el primer ejercicio natural sobre
  la plantilla: añadir la entidad que tu proyecto necesite y hacerla recorrer las
  tres capas, del modelo de dominio al router, con su migración y sus tests.
  `docs/backend-hexagonal-architecture.md` lleva el paso a paso.

- **La vertical del catálogo de ejemplo.** De `items`, `collections` y `tags` están
  puestos y cubiertos por tests solo los modelos ORM y su migración. Encima no hay
  nada todavía: ni modelos de dominio, ni ports, ni servicios, ni repositorios, ni
  routers, ni pantallas. Construir esa vertical atraviesa las tres capas de una vez
  y `docs/backend-hexagonal-architecture.md` lleva el paso a paso.

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
- **Datos ficticios.** El catálogo y los usuarios que genera el script de seed
  son datos sintéticos creados con Faker. No corresponden a personas ni a
  artículos reales.
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
