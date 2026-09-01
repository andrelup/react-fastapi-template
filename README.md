# react-fastapi-template — Tienda de libros online

react-fastapi-template es una tienda online de libros. Ofrece las mismas funcionalidades principales que esperarías de cualquier tienda de comercio electrónico moderna: registro e inicio de sesión de usuarios, navegación y búsqueda en el catálogo, compra de libros, consulta del histórico de compras, guardado de favoritos y más.

Es un **monorepo** con el backend y el frontend juntos, pensado como proyecto de formación en Claude Code y desarrollo agéntico. Aunque ambos conviven en el mismo repositorio, se **despliegan por separado**.

## Funcionalidades

- **Registro e inicio de sesión** — creación de cuenta e inicio de sesión seguro con JWT.
- **Catálogo y búsqueda** — navegación por el catálogo y búsqueda por título, autor o categoría, con búsqueda semántica mediante `pgvector`.
- **Compra** — añadir libros al carrito y completar la compra.
- **Histórico de compras** — consulta de pedidos anteriores.
- **Favoritos (wishlist)** — guardado de libros en una lista personal.
- **Recomendaciones** — sugerencias basadas en IA.
- **Rol de vendedor (seller)** — panel para gestionar el catálogo de libros propios.

## Estructura del repositorio

```
bookshelf/
├── backend/          # API REST — Python 3.12, FastAPI, Arquitectura Hexagonal
├── frontend/         # SPA — React 18, TypeScript, Bulletproof React Architecture
├── infra/            # Docker Compose, Prometheus, Grafana, SonarQube
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
| Base de datos | PostgreSQL 16 + pgvector                                               |
| Testing     | pytest / Vitest / Playwright (E2E)                                       |
| Infra       | Docker Compose, Prometheus, Grafana, SonarQube                           |
| CI/CD       | GitHub Actions                                                           |

Los dos proyectos son **independientes** y se comunican exclusivamente a través de la **API REST**; nunca comparten código directamente.

## Puesta en marcha

Requisitos: Docker y Docker Compose.

```bash
# 1. Copiar la plantilla de variables de entorno
cp .env.example .env

# 2. Levantar todo el entorno (PostgreSQL, backend, frontend, Prometheus, Grafana)
make dev

# 3. Aplicar migraciones y datos de ejemplo
make migrate
make seed
```

Con hot reload habilitado en desarrollo mediante volúmenes, los cambios en `backend/` y `frontend/` se recargan automáticamente.

## Comandos (Makefile)

Todos los comandos se ejecutan desde la raíz del monorepo:

| Comando           | Descripción                                     |
| ----------------- | ----------------------------------------------- |
| `make dev`        | `docker compose up` — levanta todo el entorno   |
| `make test`       | Tests de backend + frontend                     |
| `make test-back`  | Solo tests del backend                          |
| `make test-front` | Solo tests del frontend                         |
| `make test-e2e`   | Tests E2E con Playwright                         |
| `make lint`       | Linters de backend + frontend                   |
| `make migrate`    | `alembic upgrade head`                          |
| `make seed`       | Script de seed de datos                          |
| `make build`      | Build de las imágenes Docker de ambos proyectos |

## Convenciones globales

- **Idioma del código:** inglés (variables, funciones, clases, comentarios).
- **Idioma de la documentación:** español.
- **Tipado estricto obligatorio** en ambos stacks (mypy strict / TypeScript strict).
- Todo el código debe tener tests. **Coverage mínimo: 80 %.**

## Git

- **Conventional commits** obligatorios: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`.
- El scope indica el módulo: `feat(backend): add book search endpoint`, `fix(frontend): fix login redirect`.
- Una rama por feature: `feature/nombre-corto`.
- Los PRs van contra `main`, siempre con los tests en verde.

## Docker

- `infra/docker-compose.yml` levanta el entorno completo.
- Servicios: PostgreSQL 16, backend FastAPI, frontend React (dev), Prometheus y Grafana.
- Dockerfiles multi-stage en cada subdirectorio (`backend/Dockerfile`, `frontend/Dockerfile`).

## Configuración y secretos

- Variables de entorno en `.env` (no versionado).
- `.env.example` versionado con todas las variables necesarias y valores de ejemplo.
- Nunca se hardcodean secrets, URLs de base de datos, API keys ni tokens en el código.

## CI/CD

- GitHub Actions en `.github/workflows/`.
- Pipeline: `lint → test-backend → test-frontend → test-e2e → build → security-scan`.
- SonarQube como *quality gate* en los PRs.

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
