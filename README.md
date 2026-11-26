# react-fastapi-template — Plantilla full-stack

react-fastapi-template es una **plantilla de proyecto** full-stack compartida con la comunidad: puedes usarla para lo que quieras, también en producción (antes, lee [Uso en producción](#uso-en-producción)). Trae la autenticación y un catálogo genérico (artículos, colecciones y etiquetas) resueltos de punta a punta. El catálogo es un dominio de ejemplo, pensado para borrarlo: lo que se lleva de aquí es la arquitectura, las convenciones y el andamiaje, no el dominio.

Es un **monorepo** con el backend y el frontend juntos, preparado para trabajar con agentes de Claude Code: subagentes, skills y un `CLAUDE.md` por capa. Aunque ambos conviven en el mismo repositorio, se **despliegan por separado**.

## Funcionalidades

La plantilla resuelve la arquitectura, no un negocio concreto. Esto es lo que hay hoy, sin adornos.

**Núcleo de la plantilla:**

- **Registro e inicio de sesión** — alta de cuenta y autenticación con JWT, con la sesión persistida
  en el cliente y restaurada al recargar.
- **Roles diferenciados** — `admin`, `editor` y `viewer`, jerárquicos, con rutas de la SPA
  protegidas por rol. Son una **simulación del mecanismo**, no un modelo de permisos. El formulario
  de registro no deja elegir rol y crea cuentas `viewer`, pero la API es abierta y acepta el rol que
  le mandes: sirve para crear los primeros usuarios, y cerrarla se puede hacer de cinco maneras
  razonables (entre ellas, delegar en un proveedor de identidad como Keycloak). Cuál es la buena
  depende del proyecto, así que decidirlo es lo primero que le toca a quien use la plantilla; el
  porqué y las alternativas están en
  [0003-roles-y-registro-abierto.md](./docs/adr/0003-roles-y-registro-abierto.md).
- **Logging estructurado** — cada petición emite un evento con `request_id`, `status_code` y
  `duration_ms`, correlacionable desde la cabecera `X-Request-ID` de la respuesta.

**Dominio de ejemplo:**

- **Catálogo** — `items`, `collections` y `tags` recorren todas las capas del backend, del modelo de
  dominio al router, con permisos por rol (y por propietario en los items) y bloqueo optimista en
  items y colecciones. Los items y las colecciones tienen además sus pantallas de listado, detalle,
  alta y edición.

El ejemplo está para leerlo, copiarlo y borrarlo. Vive en carpetas `example/` dentro de cada capa, y
el procedimiento para quitarlo está en [docs/the-example-domain.md](./docs/the-example-domain.md).

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

El seed está partido en dos ficheros: `backend/seed.py` siembra las cuentas y
`backend/seed_example.py` siembra el catálogo de ejemplo —items, colecciones y etiquetas—, con
items propios para cada `EDITOR` (incluido el segundo, para poder probar que uno no edita los del
otro). El resto de usuarios y el catálogo los genera Faker con semilla fija; las cuatro cuentas por
rol son literales precisamente para que no cambien al actualizar la librería. Los dos ficheros son
parte del ejemplo: al quitarlo se borran juntos, cuentas incluidas, y el primer usuario se crea
registrándolo.

> Son **datos de desarrollo**, nunca credenciales válidas fuera de una base de datos local. El
> script no comprueba el entorno: siembra la base a la que apunte el `.env`, así que no ejecutes
> `make seed` contra una base real. La imagen de producción no lo incluye.

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

- `infra/docker-compose.yml` define tres servicios: PostgreSQL 16, el backend (FastAPI) y el frontend
  (la SPA compilada, servida por nginx).
- Un `docker compose up` sin perfil levanta solo PostgreSQL; el backend y el frontend están en el
  perfil `prod`.
- Dockerfiles multi-stage en cada subdirectorio (`backend/Dockerfile`, `frontend/Dockerfile`), solo
  de producción.

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
  censurado (`--redact`) en el log y en el SARIF. Usa las reglas por defecto
  más una sola excepción, en `.gitleaks.toml`: los nombres de algoritmo ML-KEM
  (`MLKEM768-X25519`…), que la regla genérica de claves confunde con una API
  key en las guías de la skill `modern-web-guidance`.
- `trivy`: construye las dos imágenes (`docker build`, sin publicarlas) y
  escanea el sistema de ficheros y las dos imágenes. Es el único sitio de CI que
  comprueba que los `Dockerfile` construyen, así que uno roto sale en rojo.
  `backend/` no tiene lockfile: las dependencias de Python solo se ven al
  escanear su imagen.

Las acciones de terceros van fijadas por SHA de commit, y el binario de Trivy
por versión: `trivy-action` fue comprometida en marzo de 2026
(GHSA-69fq-xp46-6x23). Un hallazgo se corrige; no se oculta con un
`.trivyignore` ni con una excepción nueva en `.gitleaks.toml` sin aprobación.

**Cómo se actualizan las dependencias.** Las directas, las que el proyecto
declara en `backend/pyproject.toml` y `frontend/package.json`, se actualizan de
una en una, revisando cada cambio. Las indirectas, como los paquetes del sistema
de las imágenes base, no se siguen así: basta con que pasen los escaneos de
seguridad. Por eso la imagen del backend instala al construirse todos los
parches de seguridad que Debian ya ha publicado (`apt-get upgrade`): la imagen
oficial de Python tarda unos días en incluirlos, y mientras tanto Trivy falla.
Ver el
[ADR 0010](./docs/adr/0010-dependencias-directas-y-paquetes-del-sistema.md).

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

El trabajo que te toca a ti al partir de la plantilla:

- **Una entidad tuya, de punta a punta.** Es el primer paso natural: añadir la
  entidad que tu proyecto necesite y hacerla recorrer el backend y el frontend,
  con su migración y sus tests. `docs/adding-a-feature.md` lleva el paso a paso.
- **Tu autenticación y tus roles.** Los que trae son un ejemplo: ver
  [Uso en producción](#uso-en-producción).
- **Quitar el dominio de ejemplo** cuando ya no te sirva de referencia, con
  `docs/the-example-domain.md`.

## Despliegue

El frontend y el backend se desarrollan juntos en este repositorio pero se **despliegan de forma independiente**, de modo que cada parte puede escalar y publicarse según su propio calendario.

## Uso en producción

Puedes usar esta plantilla para lo que quieras, también en producción. Se
distribuye tal cual, sin garantías y sin una auditoría de seguridad formal, y
**su autor no se hace responsable del uso que se haga de ella** ni de sus
consecuencias, como recoge la [licencia MIT](LICENSE).

**Lo que ya trae:**

- Contraseñas guardadas con bcrypt y JWT con el algoritmo fijado.
- Secretos y direcciones sin valor por defecto en el código; si falta uno, la
  plataforma no arranca, y el error no imprime los valores leídos.
- CORS limitado a los orígenes del `.env`.
- Imágenes que corren sin root y con `HEALTHCHECK`.
- CodeQL, gitleaks y Trivy en CI.

**Lo que tienes que hacer tú antes de publicar:**

- **Cierra el registro.** `POST /auth/register` acepta el rol que le mandan, así
  que cualquiera puede darse de alta como `admin`. Cambia también los roles y, si
  te conviene, el método de autenticación. Ver el
  [ADR 0003](./docs/adr/0003-roles-y-registro-abierto.md).
- **Cambia los secretos.** Los de `.env.example` son públicos y el backend no
  comprueba si los has cambiado: con `JWT_SECRET_KEY` sin tocar, cualquiera puede
  firmar un token válido.
- **Protege el login.** No hay límite de intentos, y las respuestas permiten
  averiguar si un email está registrado.
- **Sirve por HTTPS y añade cabeceras de seguridad** (CSP, HSTS…) en un proxy
  delante: las imágenes hablan HTTP y no las envían. El token vive en
  `localStorage`, caduca a los 60 minutos por defecto y no se puede revocar antes.
- **No expongas PostgreSQL.** El compose publica su puerto en todas las interfaces
  del host, también con el perfil `prod`.
- **Decide si `/docs` y `/openapi.json` son públicos.** Lo son por defecto.
- **No ejecutes `make seed`** contra una base real: crea cuentas con una
  contraseña conocida.

**Límites de las dependencias actuales:**

- `python-jose` 3.5.0 tiene una vulnerabilidad crítica sin versión corregida
  (CVE-2026-85394). Afecta a quien verifica sin restringir los algoritmos y con
  claves asimétricas; aquí se usa HS256 y está fijado, pero revísalo si cambias a
  RS256 o a un proveedor de identidad.
- bcrypt solo tiene en cuenta los primeros 72 bytes de la contraseña, aunque el
  registro acepta hasta 128 caracteres.
- Las dependencias transitivas de Python no están fijadas, y Trivy no avisa de las
  vulnerabilidades que aún no tienen parche (`ignore-unfixed`).

> **Free to use for anything, production included.** react-fastapi-template is
> provided as is, without warranty or a formal security audit, and its author
> accepts no liability for any use of it, under the MIT license terms. Before
> going live, close the open registration, replace the example secrets, add login
> rate limiting and serve it over HTTPS with security headers.

## Soporte y contribuciones

Es un proyecto open source con un solo colaborador, que lo atiende cuando puede.

- **Issues.** Abre una para avisar de un fallo o proponer una mejora. El autor
  las contesta cuando puede, y decide qué propuestas se hacen, con qué prioridad
  y cuándo.
- **Vulnerabilidades.** No las publiques en una issue: avísalas en privado desde
  la pestaña *Security* del repositorio, con *Report a vulnerability*.
- **Pull requests.** Para contribuir, haz un fork, trabaja en una rama y abre una
  pull request contra `develop`, nunca contra `main`: en `main` solo entran los
  merges que hace el propio proyecto desde `develop`. El autor revisa los cambios
  y, si todo está conforme, la acepta. Sigue las
  [convenciones](#convenciones-globales) y las reglas de [Git](#git):
  Conventional Commits, tests y hooks de pre-commit.

## Licencia

Publicado bajo licencia [MIT](LICENSE). Puedes usar, copiar, modificar,
fusionar, publicar y redistribuir el código libremente, incluso en obras
derivadas de licencia distinta, siempre que conserves el aviso de copyright
y de la licencia.

### Dependencias de terceros

Las librerías que usa el proyecto (entre otras FastAPI, SQLAlchemy, React y
TailwindCSS) se distribuyen bajo sus propias licencias. La licencia MIT de
este repositorio cubre únicamente el código original de react-fastapi-template.
