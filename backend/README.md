# BookShelf Backend — API REST

API REST de la tienda de libros BookShelf, construida con **Python + FastAPI** siguiendo una **arquitectura hexagonal** (Ports & Adapters). El dominio (lógica de negocio) queda aislado de los frameworks y de la infraestructura, de modo que la persistencia, la API o los servicios de IA son detalles intercambiables.

## Stack

- **Python 3.12**
- **FastAPI** (async)
- **SQLAlchemy 2.0** (async, modelos declarativos)
- **Alembic** (migraciones autogeneradas)
- **PostgreSQL 16 + pgvector** (búsqueda semántica)
- **pytest + pytest-asyncio + httpx** (testing)
- **structlog** (logging estructurado)
- **Ruff** (linting + formatting)
- **mypy** en modo strict (type checking)

## Arquitectura Hexagonal (Ports & Adapters)

El código se organiza en tres anillos: el **dominio** en el centro (lógica pura), los **ports** (interfaces que el dominio expone) y los **adapters** (implementaciones concretas de entrada y salida).

```
backend/
├── src/
│   ├── domain/                # NÚCLEO — lógica de negocio pura, sin dependencias externas
│   │   ├── models/            # Entidades de dominio (dataclasses / Pydantic)
│   │   ├── ports/             # Interfaces (Protocol) de repositorios y servicios
│   │   ├── services/          # Casos de uso (auth, book, search, recommendation)
│   │   └── exceptions.py      # Excepciones de dominio
│   │
│   ├── adapters/
│   │   ├── inbound/           # Entrada: cómo el mundo llama al dominio
│   │   │   ├── api/           # Routers FastAPI
│   │   │   ├── schemas/       # Schemas Pydantic (request/response)
│   │   │   └── middleware/    # Auth, logging, CORS, error handler
│   │   └── outbound/          # Salida: cómo el dominio accede al exterior
│   │       ├── persistence/   # Repositorios SQLAlchemy + database.py
│   │       ├── ai/            # EmbeddingService, LLMService
│   │       └── cache/         # Cachés (p. ej. recomendaciones)
│   │
│   ├── config/                # Settings (Pydantic) y container de DI
│   └── main.py                # Entrypoint FastAPI
│
├── tests/                     # unit / integration / api
├── alembic/                   # Migraciones
├── pyproject.toml
├── Dockerfile
└── seed.py
```

### Reglas de la arquitectura

1. **El dominio NO importa de adapters.** Los imports van siempre de fuera hacia dentro:
   - `adapters.inbound.api` → importa de `domain.services` y `domain.models`.
   - `adapters.outbound.persistence` → importa de `domain.ports` e implementa sus interfaces.
   - `domain.services` → importa de `domain.ports` y `domain.models`, nada más.
2. **Los ports son `Protocol` classes** (`typing.Protocol`), no clases abstractas.
3. **Los modelos de dominio son independientes de SQLAlchemy.** Los modelos ORM viven en `adapters/outbound/persistence/sqlalchemy_models.py` y se mapean desde/hacia el dominio.
4. **Inyección de dependencias en `config/container.py`.** Conecta cada port con su implementación concreta; los routers reciben los servicios ya inyectados vía `Depends`.
5. **Las excepciones de dominio se traducen en el `error_handler` middleware:** `BookNotFoundError` → 404, `UnauthorizedError` → 401, `ValidationError` → 422.

## Formato de respuesta de la API

Todas las respuestas siguen la misma envoltura:

```json
{ "success": true,  "data": { "...": "..." }, "error": null }
{ "success": false, "data": null,             "error": "Book not found" }
```

Los schemas Pydantic se separan por operación: `BookCreate`, `BookUpdate`, `BookResponse`, `BookListResponse`.

## Convenciones de código

- `snake_case` para todo (variables, funciones, archivos, módulos).
- `PascalCase` solo para clases (modelos, schemas, exceptions, protocols).
- `async/await` en todos los endpoints, servicios y repositorios.
- Type hints obligatorios en todas las funciones (mypy strict).
- Docstrings en servicios de dominio y funciones complejas.
- Los routers solo validan input, llaman al servicio y devuelven el response — **sin lógica de negocio**.

## Puesta en marcha

```bash
# Desde la raíz del monorepo, con Docker
make dev

# O en local, dentro de backend/
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
pre-commit install   # instala los git hooks (config en la raíz del monorepo)
alembic upgrade head
python seed.py
uvicorn src.main:app --reload
```

Documentación interactiva disponible en `http://localhost:8000/docs` (Swagger UI).

## Testing

- Framework: **pytest + pytest-asyncio + httpx.AsyncClient**.
- Patrón **AAA** (Arrange → Act → Assert).
- Fixtures centralizadas en `conftest.py`: test DB, async client, usuario autenticado (customer y seller).
- **Unitarios:** mockean los ports y prueban los servicios de dominio en aislamiento.
- **Integración:** usan una DB real de test para verificar los repositorios.
- **API:** `httpx.AsyncClient` contra la app FastAPI.
- Coverage mínimo: **80 %**.

```bash
pytest --cov=src --cov-report=term-missing
```

## Migraciones (Alembic)

Autogeneradas desde los modelos SQLAlchemy (no desde los modelos de dominio):

```bash
alembic revision --autogenerate -m "descripción"   # crear
alembic upgrade head                                # aplicar
alembic downgrade -1                                # rollback
```

Revisa siempre el SQL generado antes de aplicarlo.

## Logging y linting

- **structlog:** JSON en producción, *pretty-print* en desarrollo. Campos automáticos: `timestamp`, `request_id`, `user_id`, `endpoint`, `method`, `status_code`, `duration_ms`. Nunca se usa `print()`.
- **Ruff** como linter y formatter único; **mypy** en strict mode. Pre-commit hooks: `ruff check`, `ruff format`, `mypy`.

## Qué NO hacer

- No importar SQLAlchemy, FastAPI ni ninguna librería de infraestructura dentro de `domain/`.
- No poner lógica de negocio en los routers.
- No crear endpoints sin su schema Pydantic correspondiente.
- No hacer queries SQL directas — siempre a través del repositorio.
