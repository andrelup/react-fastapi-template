# Infraestructura BookShelf

Servicios del proyecto vía Docker Compose: PostgreSQL 16 con la extensión pgvector y el `backend` (FastAPI) con hot reload.

## Requisitos

- Docker Desktop en marcha.
- `.env` en la **raíz** del repo (copia `.env.example` de la raíz y rellena los valores). Es la **única** fuente de configuración: la usan tanto el compose como el backend en local. Las credenciales **nunca** se versionan ni se hardcodean en el compose.

## Uso

Desde este directorio (`infra/`). El `--env-file ../.env` apunta al `.env` de la raíz:

```bash
# Levantar todo el entorno (BD + backend con hot reload)
docker compose --env-file ../.env up --build

# Estado y salud de los contenedores
docker compose --env-file ../.env ps

# Parar (los datos persisten en el volumen postgres_data)
docker compose --env-file ../.env down

# Parar Y BORRAR los datos
docker compose --env-file ../.env down -v
```

> Equivale a `make dev` desde la raíz del repo. En Windows, si no tienes `make`, usa directamente el `docker compose` de arriba.

## Depurar el backend en local con la BD en Docker

Para poner breakpoints y depurar el backend en tu máquina, levanta **solo** la base de datos (sin el servicio `backend`) y arranca la API con `uvicorn` fuera de Docker.

Desde este directorio (`infra/`), levanta únicamente el servicio `postgres`:

```bash
# En segundo plano (-d te devuelve la terminal)
docker compose --env-file ../.env up -d postgres

# Ver los logs de la BD
docker compose --env-file ../.env logs -f postgres

# Parar solo la BD al terminar
docker compose --env-file ../.env stop postgres
```

Nombrar `postgres` al final del comando hace que el servicio `backend` **no** arranque aunque esté en el mismo `docker-compose.yml`.

Luego arranca el backend en local desde la **raíz del repo** (así lee el mismo `.env` de la raíz; `--app-dir backend` hace importable el paquete `src`). Se conecta por `localhost:${DB_PORT}`, el puerto que el contenedor expone al host:

```bash
# Activar el venv del backend
source backend/.venv/bin/activate       # Windows PowerShell: .\backend\.venv\Scripts\Activate.ps1

# Arrancar la API (CWD = raíz del repo -> usa ./.env)
uvicorn src.main:app --reload --app-dir backend
```

> El rol, la contraseña y la base (`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`) solo se crean la **primera** vez que se inicializa un volumen vacío, a partir de `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` del `.env`. Si cambias esas credenciales con el volumen ya creado, no tendrán efecto y verás errores tipo `role "..." does not exist`. En ese caso recrea el volumen con `down -v` y vuelve a levantar.

## Verificar

```bash
# Salud del contenedor
docker inspect --format '{{.State.Health.Status}}' bookshelf-postgres   # → healthy

# Conexión y extensión pgvector (usuario/base según el .env de la raíz)
docker exec -it bookshelf-postgres psql -U userAdmin -d bookShelf -c "\dx"

# Migraciones: el servicio backend ya ejecuta `alembic upgrade head` al
# arrancar con `up`. Para lanzarlas a mano, hazlo dentro del contenedor:
docker compose --env-file ../.env run --rm backend alembic upgrade head
```

La extensión pgvector se habilita automáticamente en el primer arranque mediante `postgres/init/01-pgvector.sql`.
