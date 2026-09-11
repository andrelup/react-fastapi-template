# Arquitectura Hexagonal en fastapi-template

Guía de la arquitectura del backend: qué es la arquitectura hexagonal, qué problemas resuelve y, en la práctica, **qué fichero crear y dónde** cuando añades funcionalidad nueva. Los ejemplos de autenticación son código real del proyecto. Los del catálogo de ejemplo (`Item`, `Collection`, `Tag`) muestran la **forma** que tendrá esa vertical: de momento solo existen sus modelos ORM, en `adapters/outbound/persistence/example/`; su dominio, sus ports, sus servicios y sus routers están pendientes (issues #36 y #37).

---

## 1. ¿Qué es la arquitectura hexagonal?

La arquitectura hexagonal (también llamada **Ports & Adapters**, propuesta por Alistair Cockburn) organiza el código en dos zonas con una frontera estricta entre ellas:

- **El dominio (el hexágono)**: la lógica de negocio pura. Sabe *qué* hace la aplicación (registrar usuarios, publicar artículos del catálogo, comprobar permisos), pero no sabe *cómo* se habla con el exterior. No conoce FastAPI, ni SQLAlchemy, ni PostgreSQL, ni JWT.
- **Los adaptadores (fuera del hexágono)**: el código que conecta el dominio con tecnologías concretas — la API HTTP, la base de datos, el hasher de contraseñas, un servicio de email...

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
                 │  (entidades puras)                       │
                 └──────────────────────────────────────────┘
                        Las flechas de dependencia SIEMPRE
                        apuntan hacia dentro (al dominio)
```

### ¿Qué problemas resuelve?

| Problema sin hexagonal | Cómo lo resuelve |
|---|---|
| La lógica de negocio queda mezclada con el framework (endpoints con queries SQL y reglas de permisos dentro) | El negocio vive en `domain/services/`, aislado. El router solo valida input, llama al servicio y formatea la respuesta. |
| Cambiar de tecnología (otra BD, otro proveedor externo) obliga a reescribir el negocio | Solo se reescribe el adaptador. El dominio no cambia porque depende de la interfaz (port), no de la implementación. |
| Testear el negocio requiere levantar BD y servidor | Los servicios de dominio se testean en aislamiento con fakes/mocks de sus ports: tests unitarios rápidos, sin I/O. |
| Las dependencias crecen en cualquier dirección y todo acaba acoplado con todo | Regla única y verificable: **los imports siempre apuntan hacia dentro**. `domain/` no importa de `adapters/` jamás. |

### Los tres conceptos clave

1. **Dominio** — entidades (`domain/models/`), casos de uso (`domain/services/`) y errores de negocio (`domain/exceptions.py`). Python puro: dataclasses y lógica, cero librerías de infraestructura.
2. **Port** — una interfaz que el dominio define para lo que necesita del exterior. En este proyecto son `typing.Protocol` (no clases abstractas): el adaptador cumple el contrato por *duck typing*, sin heredar de nada.
3. **Adapter** — implementación concreta de un port (**outbound**, ej. un repositorio SQLAlchemy) o punto de entrada que invoca al dominio (**inbound**, ej. un router FastAPI).

El pegamento entre ports y adapters es la **inyección de dependencias** en `config/container.py`: el único módulo autorizado a importar de `domain/` y de `adapters/` a la vez para cablearlos.

### La inversión de dependencias

El mecanismo que hace posible todo lo anterior es la **inversión de dependencias** (la "D" de SOLID). En una arquitectura en capas tradicional, la dependencia sigue al flujo de ejecución: el servicio de negocio importa el repositorio concreto, que importa el driver de base de datos — el negocio acaba dependiendo de la infraestructura, y cualquier cambio en la BD se propaga hacia arriba. La arquitectura hexagonal invierte esa flecha: **el dominio define el contrato que necesita** (`UserRepository` en `domain/ports/repositories.py`) **y es la infraestructura quien se amolda a él** (`SqlAlchemyUserRepository` en `adapters/outbound/persistence/`). El flujo de ejecución sigue yendo del servicio hacia la base de datos, pero la dependencia en el código fuente apunta al revés: el adaptador depende del dominio, nunca al contrario.

En la práctica, `AuthService` declara en su constructor que necesita *algo que cumpla* el port (`user_repository: UserRepository`) sin conocer ninguna implementación, y `config/container.py` decide en el arranque qué implementación concreta inyectar. Como los ports son `typing.Protocol`, el adaptador no necesita heredar ni importar el contrato: mypy verifica **estructuralmente** que lo cumple justo en el punto de cableado (`SqlAlchemyUserRepository(session)` devuelto como `UserRepository` en `container.py`) — si a la implementación le falta un método o cambia una firma, el type checker falla ahí antes de llegar a ejecutarse. Esta inversión es la que permite testear el dominio con fakes en memoria y la que haría posible cambiar PostgreSQL por otra tecnología tocando solo el adaptador.

---

## 2. El hexágono en este repositorio

```
backend/src/
├── domain/                          # ← EL HEXÁGONO (Python puro)
│   ├── models/                      #    Entidades: dataclasses (hoy solo User)
│   ├── ports/
│   │   ├── repositories.py          #    Interfaces de persistencia (Protocol)
│   │   └── services.py              #    Interfaces de servicios externos (Protocol)
│   ├── services/                    #    Casos de uso (hoy solo AuthService)
│   └── exceptions.py                #    Errores de negocio (DomainError y familia)
│
├── adapters/
│   ├── inbound/                     # ← ENTRADA: el mundo llama al dominio
│   │   ├── api/                     #    Routers FastAPI (auth, health)
│   │   ├── schemas/                 #    Pydantic request/response (RegisterRequest...)
│   │   └── middleware/              #    auth (JWT), error_handler, logging
│   └── outbound/                    # ← SALIDA: el dominio llama al mundo
│       ├── persistence/             #    ORM SQLAlchemy + repositorios + database.py
│       │   └── example/             #    ORM del catálogo de ejemplo (item, collection, tag)
│       └── security/                #    bcrypt (hasher), python-jose (JWT)
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

### El flujo de una request: `PUT /items/{id}`

Este recorrido describe la vertical del catálogo de ejemplo, todavía por construir. Sirve para ver el reparto de responsabilidades de punta a punta:

1. **Router** (`adapters/inbound/api/item_router.py`): FastAPI valida el body contra el schema `ItemUpdate`, resuelve `get_current_user` (middleware JWT) y `get_item_service` (container), y llama al servicio. Sin lógica de negocio.
2. **Servicio de dominio** (`domain/services/item_service.py`): aplica las reglas — el usuario debe tener el rol adecuado, debe ser el dueño del artículo, el artículo debe existir y ser válido. Si algo falla lanza una excepción de dominio (`ForbiddenError`, `ItemNotFoundError`...).
3. **Port** (`domain/ports/repositories.py`): el servicio persiste llamando a `ItemRepository.save(...)` — una interfaz, no sabe que detrás hay PostgreSQL.
4. **Adaptador outbound** (`adapters/outbound/persistence/item_repository.py`): `SqlAlchemyItemRepository` traduce entre el dataclass `Item` y el `ItemORM`, y ejecuta la query async.
5. **Error handler** (`adapters/inbound/middleware/error_handler.py`): si el servicio lanzó una excepción de dominio, la traduce al HTTP status correcto (`ForbiddenError` → 403, `ItemNotFoundError` → 404) con el envelope `ApiResponse`.

---

## 3. Caso práctico: añadir un CRUD nuevo paso a paso

Supongamos que quieres añadir un CRUD de reseñas (`Review`). Estos son los pasos, **en este orden** (de dentro hacia fuera), tomando el CRUD del catálogo (`Item`) como modelo. Son ~9 ficheros nuevos + 4 retoques.

### Paso 1 — Entidad de dominio → `domain/models/review.py`

Dataclass pura, sin SQLAlchemy ni Pydantic de API. `id: int | None = None` para representar "aún no persistida". Así quedaría la entidad `Item`, espejo de dominio del `ItemORM` ya existente:

```python
@dataclass
class Item:
    name: str
    slug: str
    owner_id: int  # referencia por id, no por objeto ORM
    description: str | None = None
    category: str | None = None
    tag_names: list[str] = field(default_factory=list)  # escalares, nunca TagORM
    id: int | None = None  # None = todavía no persistido
    version: int = 1  # bloqueo optimista
```

### Paso 2 — Port de persistencia → `domain/ports/repositories.py` (ampliar)

Añade un `Protocol` con los métodos que tu caso de uso necesita — solo esos, no un CRUD genérico por inercia:

```python
class ItemRepository(Protocol):
    async def find_by_id(self, item_id: int) -> Item | None: ...
    async def find_all(self, skip: int, limit: int) -> list[Item]: ...
    async def count(self) -> int: ...
    async def save(self, item: Item) -> Item: ...
    async def delete(self, item_id: int) -> None: ...
```

El único port implementado hoy, `UserRepository`, tiene exactamente esta pinta con tres métodos.

### Paso 3 — Excepciones de negocio → `domain/exceptions.py` (ampliar)

Una excepción por situación de negocio, heredando de `DomainError` (ej. `ReviewNotFoundError`). El error handler las traducirá a HTTP después; el dominio jamás lanza `HTTPException`.

### Paso 4 — Servicio de dominio (caso de uso) → `domain/services/review_service.py`

Aquí vive TODA la lógica: validaciones de negocio, permisos por rol, orquestación. Recibe sus ports por constructor y solo importa de `domain/`:

```python
class ItemService:
    def __init__(self, item_repository: ItemRepository) -> None:
        self._item_repository = item_repository  # el port, no la implementación

    async def delete(self, seller: User, item_id: int) -> None:
        self._ensure_seller(seller)  # regla de rol → ForbiddenError
        existing = await self._get_or_raise(item_id)  # → ItemNotFoundError
        self._ensure_owner(seller, existing)  # regla de propiedad → ForbiddenError
        await self._item_repository.delete(item_id)
```

### Paso 5 — Modelo ORM → `adapters/outbound/persistence/sqlalchemy_models.py` (ampliar)

Añade `ReviewORM` heredando de la `Base` existente. Es un fichero **distinto** del modelo de dominio a propósito: el ORM conoce tablas, columnas y FKs; el dominio no. Si la entidad pertenece al catálogo de ejemplo y no al template, va en su propio módulo dentro de `persistence/example/` y se reexporta desde el `__init__.py` de ese paquete, que es lo que registra la tabla en `Base.metadata`.

### Paso 6 — Repositorio → `adapters/outbound/persistence/review_repository.py`

Clase `SqlAlchemyReviewRepository` que implementa el Protocol del paso 2 (sin heredar de él) y mapea ORM ⇄ dominio con helpers privados:

```python
class SqlAlchemyItemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, item_id: int) -> Item | None:
        item_orm = await self._session.get(ItemORM, item_id)
        return _to_domain(item_orm) if item_orm is not None else None
```

### Paso 7 — Schemas de API → `adapters/inbound/schemas/review_schemas.py`

Pydantic, separados por operación: `ReviewCreate`, `ReviewUpdate`, `ReviewResponse`, `ReviewListResponse`. Son el contrato HTTP; pueden divergir del modelo de dominio (campos ocultos, validaciones de formato...).

### Paso 8 — Wiring → `config/container.py` (ampliar)

Una función `get_review_service` que construye el servicio con sus adaptadores concretos. Es el único sitio donde port e implementación se encuentran. Referencia real:

```python
def get_user_repository(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    return SqlAlchemyUserRepository(session)  # devuelve el PORT, construye el ADAPTER
```

### Paso 9 — Router → `adapters/inbound/api/review_router.py`

Endpoints finos: validan input (schema + `Query`), resuelven dependencias (`get_current_user`, `get_review_service`), llaman al servicio y devuelven `ApiResponse`. Cero reglas de negocio — los permisos los decide el servicio:

```python
@router.delete("/{item_id}", response_model=ApiResponse[None])
async def delete_item(
    item_id: int,
    item_service: Annotated[ItemService, Depends(get_item_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[None]:
    await item_service.delete(current_user, item_id)  # el 403/404 lo decide el dominio
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
| Llamar a un servicio externo (email, pasarela de pago, almacenamiento...) | Port en `domain/ports/services.py` + adaptador en su propio subpaquete de `adapters/outbound/` | Igual que la persistencia: contrato dentro, tecnología fuera. Ejemplo real: `PasswordHasher` y `TokenService` son ports, y bcrypt/python-jose viven en `adapters/outbound/security/`. |
| Una tabla nueva o columna nueva | `adapters/outbound/persistence/sqlalchemy_models.py` + migración en `alembic/versions/` | El esquema de BD es un detalle del adaptador de persistencia. |
| Un endpoint nuevo | `adapters/inbound/api/<contexto>_router.py` | Los routers son adaptadores de entrada, finos. |
| El formato del JSON de entrada/salida | `adapters/inbound/schemas/<contexto>_schemas.py` | El contrato HTTP es cosa del adaptador, no del dominio. |
| Algo transversal a todas las requests (auth, logging, traducción de errores) | `adapters/inbound/middleware/` | Corta el flujo de entrada antes/después del dominio. |
| Una variable de configuración / secret | `config/settings.py` (+ documentarla en el `.env` de ejemplo, nunca hardcodeada) | Un único punto tipado de acceso al entorno. |
| Conectar un port con su implementación | `config/container.py` | Único módulo que importa de ambos lados de la frontera. |
| Un fake o factory para tests | Fixture en `tests/conftest.py` si se comparte entre suites, o un fake local al módulo de test si solo lo usa él | Reutilizables entre suites; nunca en `src/`. |

### Cómo saber si algo es dominio o adaptador (regla rápida)

Pregúntate: **"¿esto seguiría siendo verdad si mañana cambiamos FastAPI por gRPC y PostgreSQL por Mongo?"**

- *"Un seller solo puede editar sus propios artículos"* → sigue siendo verdad → **dominio**.
- *"Un update sin permiso devuelve un 403 con envelope `{success, data, error}`"* → es HTTP → **adaptador inbound** (error handler).
- *"La búsqueda usa `ILIKE` sobre nombre/descripción/categoría"* → es SQL → **adaptador outbound** (repositorio). El dominio solo sabe que existe `search(query, skip, limit)`.

### Errores comunes a evitar

- ❌ Importar SQLAlchemy, FastAPI o httpx dentro de `domain/` — rompe el hexágono aunque "solo sea un type hint".
- ❌ Meter reglas de permisos en el router "porque es una línea" — la regla queda sin test unitario y se duplica en el siguiente endpoint.
- ❌ Reusar el modelo ORM como modelo de dominio o como schema de respuesta — acopla las tres capas; un cambio de columna se filtra hasta el JSON público.
- ❌ Lanzar `HTTPException` desde un servicio de dominio — el dominio no sabe qué es HTTP; lanza `DomainError` y deja que el error handler traduzca.
- ❌ Que un router importe `SqlAlchemyUserRepository` directamente — el wiring es exclusivo de `config/container.py`.
