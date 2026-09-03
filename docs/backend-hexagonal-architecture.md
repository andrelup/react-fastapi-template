# Backend — Hexagonal Architecture (Ports & Adapters)

The react-fastapi-template API is built on **Hexagonal Architecture**. This is not a stylistic preference: it is
the single most important constraint of the backend, and **every change must respect it**. A PR
that breaks the dependency rule is rejected regardless of how well it works.

This document describes the architecture **as implemented today**. Companion documents:
[database access](./backend-database-sqlalchemy.md), [code style](./backend-code-style.md),
[testing](./backend-testing.md).

---

## 1. The core idea

The business logic sits in the centre and knows nothing about the outside world. Everything
external — HTTP, PostgreSQL, JWT, bcrypt — is an **adapter** plugged into a **port** that the
domain declares.

```
                    ┌────────────────────────────┐
   HTTP request ──▶ │  inbound adapters          │
                    │  routers · schemas · auth  │
                    └──────────────┬─────────────┘
                                   │ calls
                    ┌──────────────▼─────────────┐
                    │  DOMAIN                    │
                    │  models · ports · services │   ← knows nothing else
                    └──────────────┬─────────────┘
                                   │ depends on ports (Protocol)
                    ┌──────────────▼─────────────┐
                    │  outbound adapters         │
                    │  persistence · security    │
                    └──────────────┬─────────────┘
                                   │
                              PostgreSQL, JWT, bcrypt
```

**Imports always point inwards.** The domain is the only layer with no imports from anywhere else
in the project.

---

## 2. Directory layout

```
backend/src/
├── main.py                          App factory: exception handlers, CORS, routers
│
├── config/
│   ├── settings.py                  Pydantic BaseSettings — env vars, database_url property
│   └── container.py                 THE ONLY module that imports both domain and adapters
│
├── domain/                          ── THE CORE — no external dependency whatsoever
│   ├── exceptions.py                DomainError + 10 subclasses
│   ├── models/                      Plain dataclasses: user.py, book.py, favourite.py
│   ├── ports/
│   │   ├── repositories.py          Protocol: UserRepository, BookRepository, FavouriteListRepository
│   │   └── services.py              Protocol: PasswordHasher, TokenService
│   └── services/                    Use cases: auth_service, book_service, favourite_list_service
│
└── adapters/
    ├── inbound/                     How the world calls the domain
    │   ├── api/                     auth_router, book_router, favourite_list_router, health_router
    │   ├── schemas/                 Pydantic request/response models + ApiResponse envelope
    │   └── middleware/
    │       ├── auth.py              get_current_user dependency (HTTP Bearer → AuthService)
    │       └── error_handler.py     DomainError → HTTP status mapping
    │
    └── outbound/                    How the domain reaches the world
        ├── persistence/             SQLAlchemy models, session factory, repository implementations
        ├── security/                BcryptPasswordHasher, JwtTokenService
        ├── ai/                      Empty package — reserved for embeddings / LLM
        └── cache/                   Empty package — reserved for recommendation cache
```

`adapters/outbound/ai/` and `adapters/outbound/cache/` are **stubs** today (docstring-only
`__init__.py`). Semantic search and LLM recommendations are roadmap, not shipped behaviour.

---

## 3. The rules

### Rule 1 — The domain imports nothing external

Inside `src/domain/` the only permitted imports are the standard library (`dataclasses`, `typing`,
`enum`, `datetime`…) and other `src.domain.*` modules.

**Forbidden inside `domain/`:** `fastapi`, `sqlalchemy`, `pydantic`, `jose`, `passlib`, `httpx`,
and any `src.adapters.*` import.

This is currently true with zero violations. Verify your change with:

```bash
grep -rE "fastapi|sqlalchemy|pydantic|jose|passlib|src\.adapters" backend/src/domain/
```

The command must print nothing.

### Rule 2 — Ports are `typing.Protocol`, not ABC

Ports declare what the domain needs, in the domain's own vocabulary. Adapters satisfy them
**structurally** — no adapter inherits from a port.

```python
from typing import Protocol

from src.domain.models.book import Book


class BookRepository(Protocol):
    async def find_by_id(self, book_id: int) -> Book | None: ...
    async def find_all(self, skip: int, limit: int) -> list[Book]: ...
    async def count(self) -> int: ...
    async def search(self, query: str, skip: int, limit: int) -> list[Book]: ...
    async def count_search(self, query: str) -> int: ...
    async def save(self, book: Book) -> Book: ...
    async def delete(self, book_id: int) -> None: ...
```

A port declares **only the methods the use cases actually need**. Do not add a method "for later".

### Rule 3 — Three separate representations of the same concept

Never let one class serve two layers:

| Layer | Representation | Example file |
|---|---|---|
| Domain | plain `@dataclass` | `domain/models/book.py` |
| Persistence | SQLAlchemy 2.0 `Mapped[...]` model | `adapters/outbound/persistence/sqlalchemy_models.py` |
| API | Pydantic schema | `adapters/inbound/schemas/book_schemas.py` |

```python
@dataclass
class Book:
    title: str
    author: str
    isbn: str
    price: float
    stock: int
    seller_id: int
    description: str
    category: str
    id: int | None = None
    version: int = 1
```

`User` is `@dataclass(frozen=True, slots=True)` because nothing mutates it; `Book` and
`FavouriteList` are mutable because their services modify fields before saving. Follow that
criterion for new models: **immutable unless a use case genuinely mutates it**.

The three representations differ on purpose — `BookCreate` has no `seller_id` (it is derived from
the JWT), `BookResponse` exposes `version` for optimistic-lock round-tripping.

Conversion between domain and ORM is done by explicit hand-written helpers in each repository
(`_to_domain`, `_apply_fields`). See [backend-database-sqlalchemy.md](./backend-database-sqlalchemy.md).

### Rule 4 — Business logic lives in domain services, never in routers

A router validates input, calls a service, and wraps the result. That is all. Authorization rules
(seller vs customer, ownership) are **domain rules** and live in the services:

```python
class BookService:
    def __init__(self, book_repository: BookRepository) -> None:
        self._book_repository = book_repository

    async def update(self, book_id: int, changes: Book, current_user: User) -> Book:
        existing = await self._get_or_raise(book_id)
        self._ensure_owner(existing, current_user)   # raises ForbiddenError
        self._validate(changes)                      # raises BookValidationError
        ...
```

`AuthService` is declared as a `@dataclass` holding its three ports; `BookService` and
`FavouriteListService` use an explicit `__init__`. Both are constructor injection — pick either
style, but inject **ports**, never concrete adapters.

### Rule 5 — Domain code raises domain exceptions, never `HTTPException`

`domain/exceptions.py` defines `DomainError` and its subclasses. The domain never knows an HTTP
status code exists. The translation happens in one place,
`adapters/inbound/middleware/error_handler.py`:

```python
_STATUS_CODES: dict[type[DomainError], int] = {
    BookNotFoundError: 404,
    UnauthorizedError: 401,
    InvalidCredentialsError: 401,
    ForbiddenError: 403,
    DuplicateEmailError: 409,
    BookValidationError: 422,
    FavouriteListNotFoundError: 404,
    DuplicateFavouriteListNameError: 409,
    DuplicateFavouriteBookError: 409,
    FavouriteListValidationError: 422,
}
```

The same module also handles infrastructure failures that must not leak as a 500:
`IntegrityError` → 409 (unique-constraint race), `StaleDataError` → 409 (optimistic-lock
conflict), `RequestValidationError` → 422 — with a deliberate exception: a 422 on `/auth/login` is
collapsed into a generic 401 so the endpoint cannot be used to probe which emails exist.

**When you add a domain exception, you must add its entry to `_STATUS_CODES`.**

### Rule 6 — `config/container.py` is the only place that knows both sides

It is the composition root. Nothing else may import a concrete adapter into a router or a service.

```python
def get_book_service(session: AsyncSession = Depends(get_db_session)) -> BookService:
    """Build a `BookService` wired to the SQLAlchemy `BookRepository` implementation."""
    return BookService(SqlAlchemyBookRepository(session))
```

Stateless adapters are cached singletons; per-request adapters are rebuilt from the session
dependency:

```python
@lru_cache
def get_token_service() -> TokenService:
    return JwtTokenService(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.jwt_access_token_expires_minutes,
    )
```

---

## 4. The inbound side in practice

Four routers, each with its own prefix and tag: `/auth`, `/books`, `/favourite-lists`, and the
health router (no prefix). Book search is `GET /books/search`, inside `book_router.py` — there is
no separate search router.

Endpoints receive everything through `Annotated[..., Depends(...)]`:

```python
@router.put("/{book_id}", responses=error_responses(401, 403, 404, 409, 422))
async def update_book(
    book_id: int,
    payload: BookUpdate,
    book_service: Annotated[BookService, Depends(get_book_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[BookResponse]:
    book = await book_service.update(book_id, _to_domain(payload), current_user)
    return ApiResponse(success=True, data=_to_response(book), error=None)
```

**Authentication** is `get_current_user` in `middleware/auth.py`: it resolves the HTTP Bearer
credentials and delegates to `AuthService.get_current_user(token)`, raising `UnauthorizedError`
when there are none. It answers *who* the caller is — never *what they may do*. Role and ownership
checks belong to the domain services.

**Every response uses the envelope** `ApiResponse[T]` from `schemas/common.py`:

```json
{ "success": true,  "data": { }, "error": null }
{ "success": false, "data": null, "error": "Book not found" }
```

Document the failure modes with the `error_responses(*status_codes)` helper so Swagger shows the
real error shapes.

---

## 5. Configuration

`config/settings.py` holds a single Pydantic `Settings` instance reading the repo-root `.env`
(database host/port/name/credentials, JWT secret and algorithm, token lifetime, CORS origins, log
level, environment). It exposes a computed `database_url` that builds the `postgresql+asyncpg://`
DSN with the password URL-quoted.

Rules: never hardcode a value that belongs in `.env`, never read `os.environ` outside
`settings.py`, and add every new variable to `.env.example`.

`main.py` builds the app in this order: `FastAPI(...)` → `register_exception_handlers(app)` →
CORS middleware → `include_router` for each router. There is no lifespan hook today.

---

## 6. Recipe — adding a use case end to end

Follow this order. It goes from the inside out, which is exactly the order the dependency rule
implies. Example: adding book reviews.

1. **`domain/models/review.py`** — the dataclass, with `id: int | None = None` last.
2. **`domain/exceptions.py`** — `ReviewNotFoundError(DomainError)` and any other failure the use
   case can express.
3. **`domain/ports/repositories.py`** — `class ReviewRepository(Protocol)` with only the methods
   the service needs.
4. **`domain/services/review_service.py`** — the use case. Takes the port(s) in the constructor,
   enforces the business and authorization rules, raises domain exceptions.
5. **`adapters/outbound/persistence/sqlalchemy_models.py`** — `ReviewORM(Base)` with its columns,
   constraints and indexes.
6. **Alembic migration** — `alembic revision --autogenerate -m "create reviews table"`, review the
   generated SQL, then `alembic upgrade head`.
7. **`adapters/outbound/persistence/review_repository.py`** — `SqlAlchemyReviewRepository` plus its
   `_to_domain` / `_apply_fields` helpers. No inheritance from the Protocol.
8. **`adapters/inbound/schemas/review_schemas.py`** — `ReviewCreate`, `ReviewUpdate`,
   `ReviewResponse`, `ReviewListResponse`.
9. **`config/container.py`** — `get_review_service` wiring the service to the concrete repository.
10. **`adapters/inbound/api/review_router.py`** — the thin router, `ApiResponse[T]` returns,
    `error_responses(...)` documentation.
11. **`adapters/inbound/middleware/error_handler.py`** — map the new exceptions to status codes.
12. **`src/main.py`** — `include_router(review_router)`.
13. **Tests** — a unit test of the service against a fake port, an integration test of the
    repository against the test database, and an API test of the endpoints. See
    [backend-testing.md](./backend-testing.md).

---

## 7. What NOT to do

- Do not import `fastapi`, `sqlalchemy`, `pydantic`, `jose` or `passlib` inside `domain/`.
- Do not import `src.adapters` from `src.domain`, in any form, including inside a function body or
  a `TYPE_CHECKING` block.
- Do not raise `HTTPException` outside the inbound adapters.
- Do not put business or authorization rules in a router or in the auth middleware.
- Do not reuse a Pydantic schema as a domain model, or an ORM model as an API response.
- Do not instantiate a concrete adapter anywhere except `config/container.py`.
- Do not make an adapter inherit from a port Protocol.
- Do not add a port method that no use case calls.
- Do not use `print()` — the project forbids it; log instead.
- Do not write raw SQL — go through the repository, see
  [backend-database-sqlalchemy.md](./backend-database-sqlalchemy.md).
