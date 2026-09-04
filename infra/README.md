# Infraestructura react-fastapi-template

Docker se usa aquí para **dos** cosas, y solo dos:

1. **La base de datos en desarrollo** — PostgreSQL 16, el único servicio que se levanta a diario.
2. **Las imágenes que realmente se despliegan** — el `backend` (FastAPI tras uvicorn, puerto 8000)
   y el `frontend` (la SPA compilada servida por nginx), bajo el perfil `prod`.

Lo que **no** hay es un entorno de desarrollo contenedorizado. El backend y el frontend se ejecutan
nativos en el host (`uvicorn --reload` y `vite`), que es donde el hot reload funciona de verdad y
donde no hace falta montar el árbol de fuentes dentro de un contenedor. Ese montaje es además una
brecha de aislamiento: código ejecutándose en el contenedor escribiría en tu código fuente.

## Requisitos

- Docker Desktop en marcha.
- `.env` en la **raíz** del repo (copia `.env.example` de la raíz y rellena los valores). Es la
  **única** fuente de configuración: la usan tanto el compose como el backend en local. Las
  credenciales **nunca** se versionan ni se hardcodean en el compose.

## Desarrollo: solo la base de datos

Desde la raíz del repo:

```bash
make dev          # levanta PostgreSQL en background y te dice qué lanzar
make dev-back     # terminal 2 -> API en http://localhost:8000/docs
make dev-front    # terminal 3 -> SPA en http://localhost:3000
```

El equivalente desde este directorio (`infra/`); el `--env-file ../.env` apunta al `.env` de la
raíz:

```bash
docker compose --env-file ../.env up -d postgres
docker compose --env-file ../.env logs -f postgres
```

Los servicios `backend` y `frontend` pertenecen al perfil `prod`, así que un `up` sin perfil
levanta únicamente `postgres`. No hace falta nombrarlo al final del comando.

El backend en local se conecta por `localhost:${DB_PORT}`, el puerto que el contenedor expone al
host. Si prefieres lanzarlo a mano en vez de con `make dev-back`, desde la **raíz** del repo (así
lee el mismo `.env`; `--app-dir backend` hace importable el paquete `src`):

```bash
source .venv/bin/activate      # Windows PowerShell: .\.venv\Scripts\Activate.ps1
uvicorn src.main:app --reload --app-dir backend
```

## Producción: el stack completo

```bash
make prod         # construye las dos imágenes y levanta los tres servicios
```

Equivale a `docker compose --env-file ../.env --profile prod up --build`. Levanta exactamente lo
que se despliega: sin hot reload, sin volúmenes con el código, y con el frontend sirviendo como
usuario **no root**. Es la prueba de humo antes de publicar.

- SPA en <http://localhost:3000> (nginx escucha en el 80 dentro del contenedor).
- API en <http://localhost:8000>.
- El backend aplica `alembic upgrade head` al arrancar, con el `alembic/` que la propia imagen
  copia — ya no llega por volumen.
- `VITE_API_URL` es un **build arg**, no una variable de entorno: Vite hornea la URL de la API en
  el bundle en tiempo de build. Cambiarla exige reconstruir la imagen del frontend.

## Parar

```bash
make db-down      # para y elimina los contenedores; los datos persisten
```

Equivale a `docker compose --env-file ../.env --profile prod down`. El `--profile prod` es
**imprescindible**: sin él, `down` deja en marcha los servicios que pertenecen a un perfil.

```bash
# Parar Y BORRAR los datos
docker compose --env-file ../.env --profile prod down -v
```

## Verificar

```bash
# Salud de los contenedores
docker inspect -f '{{.State.Health.Status}}' react-fastapi-template-postgres   # healthy
docker inspect -f '{{.State.Health.Status}}' react-template                    # healthy
docker inspect -f '{{.State.Health.Status}}' fastapi-template                  # healthy

# El frontend de produccion no corre como root
docker exec react-template id                                                  # uid=101(nginx)

# Ni el backend ni el frontend montan nada del host
docker inspect -f '{{len .Mounts}}' react-template fastapi-template            # 0 en ambos

# Conexion a la base (usuario/base segun el .env de la raiz)
docker exec -it react-fastapi-template-postgres psql -U bookshelf -d bookshelf -c '\dt'
```

> El rol, la contraseña y la base (`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`) solo se
> crean la **primera** vez que se inicializa un volumen vacío, a partir de `DB_USERNAME` /
> `DB_PASSWORD` / `DB_NAME` del `.env`. Si cambias esas credenciales con el volumen ya creado, no
> tendrán efecto y verás errores tipo `role "..." does not exist`. En ese caso recrea el volumen
> con `down -v` y vuelve a levantar.
