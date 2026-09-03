# Backend — Database Access with SQLAlchemy

All persistence goes through **SQLAlchemy 2.0 async**, always. There is no raw SQL anywhere in
`src/` and there must not be: no `text()`, no string-built queries, no direct driver calls. Reads
and writes happen exclusively inside the repository adapters in
`adapters/outbound/persistence/`, which are the only modules in the project allowed to import
SQLAlchemy alongside `config/` and the migrations.

Companion documents: [hexagonal architecture](./backend-hexagonal-architecture.md),
[code style](./backend-code-style.md), [testing](./backend-testing.md).

---

## 1. The three-layer split

| | Where | What it is |
|---|---|---|
| Domain model | `domain/models/book.py` | plain `@dataclass`, no SQLAlchemy |
| ORM model | `adapters/outbound/persistence/sqlalchemy_models.py` | `DeclarativeBase` + `Mapped[...]` |
| Mapping | `adapters/outbound/persistence/*_repository.py` | module-level `_to_domain` / `_apply_fields` |

**A domain object never leaves the repository as an ORM instance, and an ORM instance never
escapes the repository.** The service layer only ever sees dataclasses.

---

## 2. ORM models

One shared base for the whole project:

```python
class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
```

Conventions, taken from the existing models — follow them exactly:

```python
class BookORM(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    isbn: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    stock: Mapped[int] = mapped_column(nullable=False, default=0)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    version: Mapped[int] = mapped_column(nullable=False, default=1)

    __mapper_args__ = {"version_id_col": version}
```

- **SQLAlchemy 2.0 style only**: `Mapped[...]` + `mapped_column(...)`. Never the legacy `Column()`.
- **Strings always carry a length** (`String(255)`, `String(20)`). Free text uses `Text`.
- **Money is `Numeric(10, 2)`**, cast to `float` at the mapping boundary.
- **Foreign keys** are `mapped_column(ForeignKey("users.id"), nullable=False, index=True)`. Child
  rows that must disappear with their parent add `ondelete="CASCADE"` **on the foreign key**, not
  only on the Python-side relationship.
- **No `sa.Enum`.** `UserORM.role` is a plain `String(20)`; the domain `UserRole` enum is converted
  in the mapper (`UserRole(user_orm.role)` inbound, `user.role.value` outbound).
- **Relationships**, where an aggregate owns children:

  ```python
  items: Mapped[list["FavouriteListItemORM"]] = relationship(
      back_populates="favourite_list",
      lazy="selectin",
      cascade="all, delete-orphan",
      order_by="FavouriteListItemORM.id",
  )
  ```

  `lazy="selectin"` because a lazy load inside async code is a trap; `cascade="all, delete-orphan"`
  so removing an item from the Python list actually deletes the row; an explicit `order_by` so
  results are deterministic.

### Unique constraints

| Need | Declaration |
|---|---|
| Single column, uniqueness only | `mapped_column(..., unique=True)` → a `UNIQUE` constraint |
| Single column, also frequently filtered | `mapped_column(..., unique=True, index=True)` → a **unique index** |
| Composite | a named `UniqueConstraint` in `__table_args__` |

```python
__table_args__ = (UniqueConstraint("owner_id", "name", name="uq_favourite_lists_owner_name"),)
```

Naming: `uq_<table>_<columns>` for unique constraints, `fk_<table>_<column>_<ref_table>` for foreign
keys.

Important when auditing the schema: in PostgreSQL a unique index protects the column exactly as
strongly as a UNIQUE constraint — it just does not show up in
`information_schema.table_constraints`. Use `\d <table>` or `pg_index.indisunique`. (This once
produced a false bug report; see `backend/docs/restricciones-unicidad-sqlalchemy.md`.)

### Optimistic locking

Aggregates that can be edited concurrently carry a `version` column and
`__mapper_args__ = {"version_id_col": version}`. SQLAlchemy then emits
`UPDATE … SET version = version + 1 WHERE id = :id AND version = :version` and raises
`StaleDataError` when no row matches. `Book` and `FavouriteList` use it; `User` does not.

The version travels out to the client in the response schema and must come back on the next write.

---

## 3. Engine, session and transactions

```python
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a scoped async DB session per request."""
    async with async_session_factory() as session:
        yield session
```

- **One engine per process**, created at import time. `pool_pre_ping=True` survives dropped
  connections.
- **`expire_on_commit=False` is the single most important setting here.** After `commit()`,
  instances keep their loaded values instead of being expired and lazily re-fetched — which in
  async code would blow up. It is also why `refresh()` is called explicitly when a DB-generated
  value is needed.
- **One session per request**, injected by `get_db_session` and passed to every repository the
  request's service graph builds. Repositories take it by constructor and store it as
  `self._session`.
- **The repository owns the transaction boundary.** Every write method ends with
  `await self._session.commit()`. Services never touch the session — they cannot, they are not
  allowed to import SQLAlchemy.
- **No explicit `begin()`, no explicit `flush()`.** `session.add(...)` + `commit()` emits the
  INSERT; `commit()` implies the flush.
- **`refresh()` after every write**, to pick up the autoincrement id and the bumped version before
  mapping back to the domain.

---

## 4. Query patterns

Use these; do not invent new ones.

**By primary key** — `session.get`, no `select()` needed:

```python
book_orm = await self._session.get(BookORM, book_id)
return _to_domain(book_orm) if book_orm is not None else None
```

**Paginated list:**

```python
stmt = select(BookORM).order_by(BookORM.id).offset(skip).limit(limit)
result = await self._session.execute(stmt)
return [_to_domain(row) for row in result.scalars().all()]
```

**Count, for pagination:**

```python
stmt = select(func.count()).select_from(BookORM)
result = await self._session.execute(stmt)
return int(result.scalar_one())
```

**Filter reused by a search/count pair** — factor the predicate into a module-level helper so the
two queries can never drift:

```python
def _search_filter(query: str) -> ColumnElement[bool]:
    pattern = f"%{query}%"
    return or_(
        BookORM.title.ilike(pattern),
        BookORM.author.ilike(pattern),
        BookORM.category.ilike(pattern),
    )
```

**Unique lookup by a non-PK column** — `scalar_one_or_none()`:

```python
result = await self._session.execute(select(UserORM).where(UserORM.email == email))
user_orm = result.scalar_one_or_none()
```

Multiple predicates in one `.where(a, b)` are ANDed.

**Insert** — build the ORM object, `add`, `commit`, `refresh`:

```python
book_orm = BookORM(title=book.title, isbn=book.isbn, ...)
self._session.add(book_orm)
await self._session.commit()
await self._session.refresh(book_orm)
return _to_domain(book_orm)
```

**Update** — unit-of-work style: load the row, mutate attributes, commit. **Never** a bulk
`update()` statement:

```python
book_orm = await self._session.get(BookORM, book.id)
if book_orm is None:
    raise ValueError(f"Cannot update book {book.id}: it does not exist")
attributes.set_committed_value(book_orm, "version", book.version)
_apply_fields(book_orm, book)
await self._session.commit()
await self._session.refresh(book_orm)
```

`set_committed_value` is load-bearing: it makes `version_id_col` compare against the version the
**caller** read, not the freshly re-read one, so a lost update is actually detected. Keep it.

**Delete** — load, delete, commit; a missing row is a no-op:

```python
book_orm = await self._session.get(BookORM, book_id)
if book_orm is not None:
    await self._session.delete(book_orm)
    await self._session.commit()
```

**Child collections** — reconcile, do not delete-all-and-recreate, so unrelated rows keep their
identity:

```python
def _reconcile_items(list_orm: FavouriteListORM, book_ids: list[int]) -> None:
    """Make `list_orm.items` match `book_ids`, preserving existing rows."""
    desired = list(dict.fromkeys(book_ids))
    current = {item.book_id: item for item in list_orm.items}
    for book_id, item in current.items():
        if book_id not in desired:
            list_orm.items.remove(item)
    for book_id in desired:
        if book_id not in current:
            list_orm.items.append(FavouriteListItemORM(book_id=book_id))
```

When only children changed, the parent's `version` would not bump on its own — force it with
`attributes.flag_modified(list_orm, "name")`, as `favourite_list_repository.save()` does.

**Not used, deliberately:** upserts (`ON CONFLICT`), bulk `update()`/`delete()` statements, lazy
relationship loads, and raw SQL. Idempotency is achieved with an application-side pre-check, the way
`seed.py` does it.

---

## 5. Mapping domain ↔ ORM

Small private module-level functions in the repository file — never a method on the ORM model, never
on the domain model:

```python
def _to_domain(book_orm: BookORM) -> Book:
    return Book(
        id=book_orm.id,
        title=book_orm.title,
        isbn=book_orm.isbn,
        price=float(book_orm.price),   # Numeric -> Decimal -> float
        stock=book_orm.stock,
        seller_id=book_orm.seller_id,
        version=book_orm.version,
    )


def _apply_fields(book_orm: BookORM, book: Book) -> None:
    book_orm.title = book.title
    book_orm.isbn = book.isbn
    ...
```

`_apply_fields` deliberately does **not** touch `id` (immutable) or `version` (handled by
`set_committed_value`). Relationship children are flattened here too — `FavouriteList` only ever
sees `book_ids: list[int]`, never `FavouriteListItemORM`.

---

## 6. Integrity errors

Two layers, covering two different failure windows:

1. **A business pre-check in the service.** `AuthService` calls `find_by_email` and raises
   `DuplicateEmailError` before writing. This produces a specific, well-worded error for the normal
   case.
2. **The database constraint, for the race** where two concurrent requests both pass the check.
   **No repository catches `IntegrityError`** — do not add a try/except around `commit()`. It is
   handled once, centrally, in `middleware/error_handler.py`, which turns it into a 409, and
   `StaleDataError` into a 409 with a distinct message.

So: add the constraint to the model, add the pre-check to the service, and let the middleware do
the rest.

---

## 7. Alembic

`alembic/env.py` targets `Base.metadata` from `sqlalchemy_models.py` — **migrations autogenerate
from the ORM models, never from the domain models** — and takes the URL from `settings.database_url`,
not from `alembic.ini`.

```bash
alembic revision --autogenerate -m "create reviews table"
alembic upgrade head        # or: make migrate
alembic downgrade -1
```

**Always read the generated migration before applying it.** Autogenerate is a starting point:
check that foreign keys are explicitly named following `fk_<table>_<column>_<ref_table>`, that every
FK column has an index, and that composite unique constraints kept their `uq_…` name. The history
shows why this matters — the books migration had to be reconciled by hand after a rebase so it
chained after the users migration and could carry a real FK.

Adding a `NOT NULL` column to a populated table uses `server_default` to backfill in one step,
as the `version` migration does.

Current history is linear: users → books → favourite lists/items → version columns.

---

## 8. The seed script

`backend/seed.py` writes **only through the repositories**, never through the session or raw SQL,
so it can never drift from the persistence rules. It inserts in FK order (users → books → favourite
lists), truncates values to the ORM column lengths, hashes passwords with the production hasher, and
is idempotent through a `find_by_email` pre-check. Run it with `make seed`.

Keep that contract when you extend it: new seed data goes through the repository for its entity.

---

## 9. Adding a new entity — checklist

1. **ORM model** in `sqlalchemy_models.py`, with lengths, indexes, FKs, named constraints, and
   `version_id_col` only if the aggregate needs optimistic locking.
2. **Migration**: `alembic revision --autogenerate`, review it, `alembic upgrade head`.
3. **Port** in `domain/ports/repositories.py` — only the methods the use case needs.
4. **Repository** in `adapters/outbound/persistence/<entity>_repository.py`, with its
   `_to_domain` / `_apply_fields` helpers, following the insert/update/delete patterns above. No
   inheritance from the Protocol.
5. **Wiring** in `config/container.py`.
6. **Fake** in `tests/fakes/`, honouring the same invariants (including optimistic locking).
7. **Integration tests** with a session fixture in `tests/integration/conftest.py`.

---

## 10. What NOT to do

- No raw SQL: no `text()`, no f-string queries, no driver-level calls.
- No SQLAlchemy import outside `adapters/outbound/persistence/`, `config/`, `alembic/` and the
  tests.
- No lazy relationship loading — declare `lazy="selectin"`.
- No bulk `update()`/`delete()` statements; load and mutate.
- No `session.commit()` in a service or a router; the repository owns it.
- No `try/except IntegrityError` in a repository; the middleware handles it.
- No ORM instance returned to the domain, and no domain dataclass passed to `session.add()`.
- No `sa.Enum`; convert in the mapper.
- No credentials in code — the DSN is built by `settings.database_url` from environment variables.
