# Arquitectura Hexagonal en BookShelf

Guía de la arquitectura del backend: qué es la arquitectura hexagonal, qué problemas resuelve y, en la práctica, **qué fichero crear y dónde** cuando añades funcionalidad nueva. Los ejemplos usan código real del proyecto (auth y catálogo de libros).

---

## 1. ¿Qué es la arquitectura hexagonal?

La arquitectura hexagonal (también llamada **Ports & Adapters**, propuesta por Alistair Cockburn) organiza el código en dos zonas con una frontera estricta entre ellas:

- **El dominio (el hexágono)**: la lógica de negocio pura. Sabe *qué* hace la aplicación (registrar usuarios, vender libros, comprobar permisos), pero no sabe *cómo* se habla con el exterior. No conoce FastAPI, ni SQLAlchemy, ni PostgreSQL, ni JWT.
- **Los adaptadores (fuera del hexágono)**: el código que conecta el dominio con tecnologías concretas — la API HTTP, la base de datos, servicios de IA, caché...

La comunicación entre ambas zonas ocurre siempre a través de **ports**: interfaces que define el dominio. Un adaptador *implementa* un port (o lo *invoca*), pero el dominio solo conoce la interfaz.

```
                 ┌──────────────────────────────────────────┐
   INBOUND       │                 DOMINIO                  │      OUTBOUND
 (quién me llama)│           (lógica de negocio)            │ (a quién llamo yo)
                 │                                          │
  FastAPI   ───► │  services/  ──usa──►  ports/ (Protocol)  │ ◄─── SQLAlchemy
  routers        │  (casos de uso)       (interfaces)       │      repositorios
                 │        │                                 │
  middleware ──► │        ▼                                 │ ◄─── bcrypt / JWT
  (auth, errors) │     models/  +  exceptions.py            │
                 │  (entidades puras)                       │ ◄─── servicios IA
                 └──────────────────────────────────────────┘
                        Las flechas de dependencia SIEMPRE
                        apuntan hacia dentro (al dominio)
```

### ¿Qué problemas resuelve?

| Problema sin hexagonal | Cómo lo resuelve |
|---|---|
| La lógica de negocio queda mezclada con el framework (endpoints con queries SQL y reglas de permisos dentro) | El negocio vive en `domain/services/`, aislado. El router solo valida input, llama al servicio y formatea la respuesta. |
| Cambiar de tecnología (otra BD, otro proveedor de IA) obliga a reescribir el negocio | Solo se reescribe el adaptador. El dominio no cambia porque depende de la interfaz (port), no de la implementación. |
| Testear el negocio requiere levantar BD y servidor | Los servicios de dominio se testean en aislamiento con fakes/mocks de sus ports: tests unitarios rápidos, sin I/O. |
| Las dependencias crecen en cualquier dirección y todo acaba acoplado con todo | Regla única y verificable: **los imports siempre apuntan hacia dentro**. `domain/` no importa de `adapters/` jamás. |

### Los tres conceptos clave

1. **Dominio** — entidades (`domain/models/`), casos de uso (`domain/services/`) y errores de negocio (`domain/exceptions.py`). Python puro: dataclasses y lógica, cero librerías de infraestructura.
2. **Port** — una interfaz que el dominio define para lo que necesita del exterior. En este proyecto son `typing.Protocol` (no clases abstractas): el adaptador cumple el contrato por *duck typing*, sin heredar de nada.
3. **Adapter** — implementación concreta de un port (**outbound**, ej. un repositorio SQLAlchemy) o punto de entrada que invoca al dominio (**inbound**, ej. un router FastAPI).

El pegamento entre ports y adapters es la **inyección de dependencias** en `config/container.py`: el único módulo autorizado a importar de `domain/` y de `adapters/` a la vez para cablearlos.

### La inversión de dependencias

El mecanismo que hace posible todo lo anterior es la **inversión de dependencias** (la "D" de SOLID). En una arquitectura en capas tradicional, la dependencia sigue al flujo de ejecución: el servicio de negocio importa el repositorio concreto, que importa el driver de base de datos — el negocio acaba dependiendo de la infraestructura, y cualquier cambio en la BD se propaga hacia arriba. La arquitectura hexagonal invierte esa flecha: **el dominio define el contrato que necesita** (`BookRepository` en `domain/ports/repositories.py`) **y es la infraestructura quien se amolda a él** (`SqlAlchemyBookRepository` en `adapters/outbound/persistence/`). El flujo de ejecución sigue yendo del servicio hacia la base de datos, pero la dependencia en el código fuente apunta al revés: el adaptador depende del dominio, nunca al contrario.

En la práctica, `BookService` declara en su constructor que necesita *algo que cumpla* el port (`book_repository: BookRepository`) sin conocer ninguna implementación, y `config/container.py` decide en el arranque qué implementación concreta inyectar. Como los ports son `typing.Protocol`, el adaptador no necesita heredar ni importar el contrato: mypy verifica **estructuralmente** que lo cumple justo en el punto de cableado (`BookService(SqlAlchemyBookRepository(session))` en `container.py`) — si a la implementación le falta un método o cambia una firma, el type checker falla ahí antes de llegar a ejecutarse. Esta inversión es la que permite testear el dominio con fakes en memoria (`tests/fakes/fake_book_repository.py`) y la que haría posible cambiar PostgreSQL por otra tecnología tocando solo el adaptador.

---

## 2. El hexágono en este repositorio

```
backend/src/
├── domain/                          # ← EL HEXÁGONO (Python puro)
│   ├── models/                      #    Entidades: dataclasses (User, Book...)
│   ├── ports/
│   │   ├── repositories.py          #    Interfaces de persistencia (Protocol)
│   │   └── services.py              #    Interfaces de servicios externos (Protocol)
│   ├── services/                    #    Casos de uso (AuthService, BookService...)
│   └── exceptions.py                #    Errores de negocio (DomainError y familia)
│
├── adapters/
│   ├── inbound/                     # ← ENTRADA: el mundo llama al dominio
│   │   ├── api/                     #    Routers FastAPI (endpoints)
│   │   ├── schemas/                 #    Pydantic request/response (BookCreate...)
│   │   └── middleware/              #    auth (JWT), error_handler, logging
│   └── outbound/                    # ← SALIDA: el dominio llama al mundo
│       ├── persistence/             #    ORM SQLAlchemy + repositorios + database.py
│       ├── security/                #    bcrypt (hasher), python-jose (JWT)
│       ├── ai/                      #    embeddings, LLM (futuros)
│       └── cache/
│
├── config/
│   ├── settings.py                  #    Pydantic Settings (variables de entorno)
│   └── container.py                 #    DI: cablea ports → adapters (Depends)
└── main.py                          #    Crea la app, registra routers y handlers
```

**La regla de oro** (de `backend/CLAUDE.md`): los imports van siempre de fuera hacia dentro.

- `adapters/inbound/api` → importa de `domain/services` y `domain/models` ✔
- `adapters/outbound/persistence` → importa de `domain/ports` y `domain/models` ✔
- `domain/*` → importa solo de `domain/*` ✔
- `domain/*` → importa de `adapters/*` ✘ **nunca, bajo ninguna circunstancia**

### El flujo de una request real: `PUT /books/{id}`

1. **Router** (`adapters/inbound/api/book_router.py`): FastAPI valida el body contra el schema `BookUpdate`, resuelve `get_current_user` (middleware JWT) y `get_book_service` (container), y llama al servicio. Sin lógica de negocio.
2. **Servicio de dominio** (`domain/services/book_service.py`): aplica las reglas — el usuario debe ser seller, debe ser el dueño del libro, el libro debe existir y ser válido. Si algo falla lanza una excepción de dominio (`ForbiddenError`, `BookNotFoundError`...).
3. **Port** (`domain/ports/repositories.py`): el servicio persiste llamando a `BookRepository.save(...)` — una interfaz, no sabe que detrás hay PostgreSQL.
4. **Adaptador outbound** (`adapters/outbound/persistence/book_repository.py`): `SqlAlchemyBookRepository` traduce entre el dataclass `Book` y el `BookORM`, y ejecuta la query async.
5. **Error handler** (`adapters/inbound/middleware/error_handler.py`): si el servicio lanzó una excepción de dominio, la traduce al HTTP status correcto (`ForbiddenError` → 403, `BookNotFoundError` → 404) con el envelope `ApiResponse`.

---

## 3. Caso práctico: añadir un CRUD nuevo paso a paso

Supongamos que quieres añadir un CRUD de reseñas (`Review`). Estos son los pasos, **en este orden** (de dentro hacia fuera), con el CRUD real de `Book` como referencia. Son ~9 ficheros nuevos + 4 retoques.

### Paso 1 — Entidad de dominio → `domain/models/review.py`

Dataclass pura, sin SQLAlchemy ni Pydantic de API. `id: int | None = None` para representar "aún no persistida". Referencia real: `domain/models/book.py`:

```python
@dataclass
class Book:
    title: str
    author: str
    isbn: str
    price: float
    stock: int
    seller_id: int          # referencia por id, no por objeto ORM
    description: str
    category: str
    id: int | None = None   # None = todavía no persistido
```

### Paso 2 — Port de persistencia → `domain/ports/repositories.py` (ampliar)

Añade un `Protocol` con los métodos que tu caso de uso necesita — solo esos, no un CRUD genérico por inercia. Referencia real:

```python
class BookRepository(Protocol):
    async def find_by_id(self, book_id: int) -> Book | None: ...
    async def find_all(self, skip: int, limit: int) -> list[Book]: ...
    async def count(self) -> int: ...
    async def save(self, book: Book) -> Book: ...
    async def delete(self, book_id: int) -> None: ...
```

### Paso 3 — Excepciones de negocio → `domain/exceptions.py` (ampliar)

Una excepción por situación de negocio, heredando de `DomainError` (ej. `ReviewNotFoundError`). El error handler las traducirá a HTTP después; el dominio jamás lanza `HTTPException`.

### Paso 4 — Servicio de dominio (caso de uso) → `domain/services/review_service.py`

Aquí vive TODA la lógica: validaciones de negocio, permisos por rol, orquestación. Recibe sus ports por constructor y solo importa de `domain/`. Referencia real, `domain/services/book_service.py`:

```python
class BookService:
    def __init__(self, book_repository: BookRepository) -> None:
        self._book_repository = book_repository   # el port, no la implementación

    async def delete(self, seller: User, book_id: int) -> None:
        self._ensure_seller(seller)                # regla de rol → ForbiddenError
        existing = await self._get_or_raise(book_id)  # → BookNotFoundError
        self._ensure_owner(seller, existing)       # regla de propiedad → ForbiddenError
        await self._book_repository.delete(book_id)
```

### Paso 5 — Modelo ORM → `adapters/outbound/persistence/sqlalchemy_models.py` (ampliar)

Añade `ReviewORM` heredando de la `Base` existente. Es un fichero **distinto** del modelo de dominio a propósito: el ORM conoce tablas, columnas y FKs; el dominio no.

### Paso 6 — Repositorio → `adapters/outbound/persistence/review_repository.py`

Clase `SqlAlchemyReviewRepository` que implementa el Protocol del paso 2 (sin heredar de él) y mapea ORM ⇄ dominio con helpers privados. Referencia real, `book_repository.py`:

```python
class SqlAlchemyBookRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, book_id: int) -> Book | None:
        book_orm = await self._session.get(BookORM, book_id)
        return _to_domain(book_orm) if book_orm is not None else None
```

### Paso 7 — Schemas de API → `adapters/inbound/schemas/review_schemas.py`

Pydantic, separados por operación: `ReviewCreate`, `ReviewUpdate`, `ReviewResponse`, `ReviewListResponse`. Son el contrato HTTP; pueden divergir del modelo de dominio (campos ocultos, validaciones de formato...).

### Paso 8 — Wiring → `config/container.py` (ampliar)

Una función `get_review_service` que construye el servicio con sus adaptadores concretos. Es el único sitio donde port e implementación se encuentran. Referencia real:

```python
def get_user_repository(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    return SqlAlchemyUserRepository(session)   # devuelve el PORT, construye el ADAPTER
```

### Paso 9 — Router → `adapters/inbound/api/review_router.py`

Endpoints finos: validan input (schema + `Query`), resuelven dependencias (`get_current_user`, `get_review_service`), llaman al servicio y devuelven `ApiResponse`. Cero reglas de negocio — los permisos los decide el servicio. Referencia real, `book_router.py`:

```python
@router.delete("/{book_id}", response_model=ApiResponse[None])
async def delete_book(
    book_id: int,
    book_service: Annotated[BookService, Depends(get_book_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[None]:
    await book_service.delete(current_user, book_id)   # el 403/404 lo decide el dominio
    return ApiResponse(success=True, data=None, error=None)
```

### Paso 10 — Registrar el router → `src/main.py` (ampliar)

```python
app.include_router(review_router)
```

### Paso 11 — Migración Alembic

```bash
alembic revision --autogenerate -m "create reviews table"   # desde el ORM, nunca desde el dominio
# revisar el SQL generado ANTES de aplicar
alembic upgrade head
```

### Paso 12 — Tests (una capa, un tipo de test)

| Qué se testea | Tipo | Dónde | Estrategia |
|---|---|---|---|
| `ReviewService` (reglas, permisos, errores) | Unitario | `tests/unit/test_review_service.py` | Fake/mock del port. Sin BD, sin FastAPI. |
| `SqlAlchemyReviewRepository` | Integración | `tests/integration/test_review_repository.py` | PostgreSQL real de test. |
| `review_router` (status codes, envelope, validación) | API | `tests/api/test_review_endpoints.py` | `httpx.AsyncClient` + `dependency_overrides` del port. |

Patrón AAA con comentarios, fixtures compartidas en `tests/conftest.py`, coverage ≥ 80% (`pytest --cov=src --cov-report=term-missing`).

---

## 4. Casos específicos: ¿dónde va cada fichero?

Chuleta de decisión — "quiero hacer X → el fichero va en Y":

| Quiero... | Fichero | Por qué ahí |
|---|---|---|
| Una entidad de negocio nueva | `domain/models/<entidad>.py` | Es vocabulario del negocio. Dataclass pura. |
| Una regla de negocio o caso de uso | `domain/services/<contexto>_service.py` | El negocio vive junto, testeable sin infraestructura. |
| Un error de negocio (ej. "sin stock") | `domain/exceptions.py` | El dominio expresa el fallo; el HTTP status lo decide el middleware. |
| Guardar/leer algo de la BD | Port en `domain/ports/repositories.py` + implementación en `adapters/outbound/persistence/<x>_repository.py` | El dominio define el contrato; SQLAlchemy queda fuera del hexágono. |
| Llamar a un servicio externo (LLM, embeddings, email...) | Port en `domain/ports/services.py` + adaptador en `adapters/outbound/ai/` (u otro subpaquete) | Igual que la persistencia: contrato dentro, tecnología fuera. Ejemplo real: `PasswordHasher` y `TokenService` son ports, y bcrypt/python-jose viven en `adapters/outbound/security/`. |
| Una tabla nueva o columna nueva | `adapters/outbound/persistence/sqlalchemy_models.py` + migración en `alembic/versions/` | El esquema de BD es un detalle del adaptador de persistencia. |
| Un endpoint nuevo | `adapters/inbound/api/<contexto>_router.py` | Los routers son adaptadores de entrada, finos. |
| El formato del JSON de entrada/salida | `adapters/inbound/schemas/<contexto>_schemas.py` | El contrato HTTP es cosa del adaptador, no del dominio. |
| Algo transversal a todas las requests (auth, logging, traducción de errores) | `adapters/inbound/middleware/` | Corta el flujo de entrada antes/después del dominio. |
| Una variable de configuración / secret | `config/settings.py` (+ documentarla en el `.env` de ejemplo, nunca hardcodeada) | Un único punto tipado de acceso al entorno. |
| Conectar un port con su implementación | `config/container.py` | Único módulo que importa de ambos lados de la frontera. |
| Un fake o factory para tests | `tests/fakes/`, `tests/factories.py` o fixture en `tests/conftest.py` | Reutilizables entre suites; nunca en `src/`. |

### Cómo saber si algo es dominio o adaptador (regla rápida)

Pregúntate: **"¿esto seguiría siendo verdad si mañana cambiamos FastAPI por gRPC y PostgreSQL por Mongo?"**

- *"Un seller solo puede editar sus propios libros"* → sigue siendo verdad → **dominio**.
- *"Un update sin permiso devuelve un 403 con envelope `{success, data, error}`"* → es HTTP → **adaptador inbound** (error handler).
- *"La búsqueda usa `ILIKE` sobre título/autor/categoría"* → es SQL → **adaptador outbound** (repositorio). El dominio solo sabe que existe `search(query, skip, limit)`.

### Errores comunes a evitar

- ❌ Importar SQLAlchemy, FastAPI o httpx dentro de `domain/` — rompe el hexágono aunque "solo sea un type hint".
- ❌ Meter reglas de permisos en el router "porque es una línea" — la regla queda sin test unitario y se duplica en el siguiente endpoint.
- ❌ Reusar el modelo ORM como modelo de dominio o como schema de respuesta — acopla las tres capas; un cambio de columna se filtra hasta el JSON público.
- ❌ Lanzar `HTTPException` desde un servicio de dominio — el dominio no sabe qué es HTTP; lanza `DomainError` y deja que el error handler traduzca.
- ❌ Que un router importe `SqlAlchemyBookRepository` directamente — el wiring es exclusivo de `config/container.py`.
