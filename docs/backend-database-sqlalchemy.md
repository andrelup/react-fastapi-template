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
| Domain model | `domain/models/user.py` | plain `@dataclass`, no SQLAlchemy |
| ORM model | `adapters/outbound/persistence/sqlalchemy_models.py` (`Base`, `UserORM`) and `adapters/outbound/persistence/example/` (the sample catalogue) | `DeclarativeBase` + `Mapped[...]` |
| Mapping | `adapters/outbound/persistence/*_repository.py` | module-level `_to_domain` / `_apply_fields` |

The ORM layer is split in two on purpose. `sqlalchemy_models.py` holds what belongs to the
template itself — the shared `Base` and `UserORM`. The `example/` package holds the neutral sample
catalogue (`items`, `collections`, `tags` and their association tables) and nothing outside it
references those classes, so deleting the sample domain from a generated project is a `rm -rf` of
that directory plus the single marked import in `alembic/env.py`.

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
class ItemORM(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", name="fk_items_owner_id_users"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(nullable=False, default=1)

    __mapper_args__ = {"version_id_col": version}
```

- **SQLAlchemy 2.0 style only**: `Mapped[...]` + `mapped_column(...)`. Never the legacy `Column()`
  — with one deliberate exception, the association tables below, which are bare `Table` objects and
  therefore have to use `Column()`.
- **Strings always carry a length** (`String(200)`, `String(50)`). Free text uses `Text`.
- **Nullability is explicit** on every column, and an optional column is typed `Mapped[str | None]`
  so mypy agrees with the schema.
- **Foreign keys** are named and cascading:
  `ForeignKey("users.id", ondelete="CASCADE", name="fk_items_owner_id_users")`, plus `index=True` on
  the column. Rows that must disappear with their parent declare `ondelete="CASCADE"` **on the
  foreign key**, not only on the Python-side relationship.
- **A foreign key does not imply a relationship.** `items.owner_id` points at `users` with a plain
  FK and no `relationship()`: the dependency runs one way only, so `UserORM` — template code —
  never references the sample domain and the `example/` package stays deletable on its own.
- **No `sa.Enum`.** `UserORM.role` is a plain `String(20)`; the domain `UserRole` enum is converted
  in the mapper (`UserRole(user_orm.role)` inbound, `user.role.value` outbound). `ItemORM.category`
  is a plain `String(50)` for the same reason.
- **Relationships** are `secondary` many-to-many links here, declared on both sides with
  `back_populates`:

  ```python
  tags: Mapped[list["TagORM"]] = relationship(
      secondary=item_tags_table,
      back_populates="items",
      lazy="selectin",
      order_by="TagORM.name",
  )
  ```

  `lazy="selectin"` because a lazy load inside async code is a trap; an explicit `order_by` so
  results are deterministic. **No `cascade="all, delete-orphan"` on a `secondary` relationship** —
  it would delete the far-side row instead of the association row. Cleaning up link rows is the
  foreign key's `ondelete="CASCADE"` job.

  Two mutual `lazy="selectin"` relationships stop eager-loading after one hop: the `TagORM.items`
  reached from an item comes back *unloaded*, and touching it falls back to a lazy load, which is
  `MissingGreenlet` under asyncio. A mapper may read scalar columns off the far side (`tag.name`)
  but never its reverse collection.

### Association tables

A link table that carries no columns of its own beyond the two foreign keys is a bare `Table`, not
a mapped class — a class would be noise:

```python
item_tags_table = Table(
    "item_tags",
    Base.metadata,
    Column(
        "item_id",
        Integer,
        ForeignKey("items.id", ondelete="CASCADE", name="fk_item_tags_item_id_items"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE", name="fk_item_tags_tag_id_tags"),
        primary_key=True,
        index=True,
    ),
)
```

The two foreign keys are the composite primary key — no surrogate `id`. Only the **trailing** key
column gets its own `index=True`: the leading one already rides the composite primary key index,
while the trailing one needs an index of its own so the FK's `ON DELETE CASCADE` and the reverse
lookup do not fall back to a sequential scan. The table lives in the module of the entity it hangs
off an item (`item_tags_table` in `tag.py`, `item_collections_table` in `collection.py`).

### Unique constraints

| Need | Declaration |
|---|---|
| Single column, uniqueness only | `mapped_column(..., unique=True)` → a `UNIQUE` constraint |
| Single column, also frequently filtered | `mapped_column(..., unique=True, index=True)` → a **unique index** |
| Composite, or any constraint whose name must be explicit | a named `UniqueConstraint` in `__table_args__` |

```python
__table_args__ = (UniqueConstraint("name", name="uq_collections_name"),)
```

`CollectionORM` uses the third form for a single column: a named `UniqueConstraint` rather than
`unique=True`, because the name is never filtered on — only kept unique — so a unique *index* would
be unused weight. `ItemORM.slug` is the second form (`unique=True, index=True`): it is both unique
and looked up by value.

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
`StaleDataError` when no row matches. `Item` and `Collection` use it; `User` and `Tag` do not —
nothing edits them concurrently.

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
item_orm = await self._session.get(ItemORM, item_id)
return _to_domain(item_orm) if item_orm is not None else None
```

**Paginated list:**

```python
stmt = select(ItemORM).order_by(ItemORM.id).offset(skip).limit(limit)
result = await self._session.execute(stmt)
return [_to_domain(row) for row in result.scalars().all()]
```

**Count, for pagination:**

```python
stmt = select(func.count()).select_from(ItemORM)
result = await self._session.execute(stmt)
return int(result.scalar_one())
```

**Filter reused by a search/count pair** — factor the predicate into a module-level helper so the
two queries can never drift:

```python
def _search_filter(query: str) -> ColumnElement[bool]:
    pattern = f"%{query}%"
    return or_(
        ItemORM.name.ilike(pattern),
        ItemORM.description.ilike(pattern),
        ItemORM.category.ilike(pattern),
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
item_orm = ItemORM(name=item.name, slug=item.slug, ...)
self._session.add(item_orm)
await self._session.commit()
await self._session.refresh(item_orm)
return _to_domain(item_orm)
```

**Update** — unit-of-work style: load the row, mutate attributes, commit. **Never** a bulk
`update()` statement:

```python
item_orm = await self._session.get(ItemORM, item.id)
if item_orm is None:
    raise ValueError(f"Cannot update item {item.id}: it does not exist")
attributes.set_committed_value(item_orm, "version", item.version)
_apply_fields(item_orm, item)
await self._session.commit()
await self._session.refresh(item_orm)
```

`set_committed_value` is load-bearing: it makes `version_id_col` compare against the version the
**caller** read, not the freshly re-read one, so a lost update is actually detected. Keep it.

**Delete** — load, delete, commit; a missing row is a no-op:

```python
item_orm = await self._session.get(ItemORM, item_id)
if item_orm is not None:
    await self._session.delete(item_orm)
    await self._session.commit()
```

**Linked collections** (`tags`, `collections`) — reconcile in place, do not clear-and-refill, so the
unchanged association rows keep their identity:

```python
def _reconcile_tags(item_orm: ItemORM, tag_orms: list[TagORM]) -> None:
    """Make `item_orm.tags` match `tag_orms`, preserving existing links."""
    desired = {tag.id: tag for tag in tag_orms}
    for tag in list(item_orm.tags):
        if tag.id not in desired:
            item_orm.tags.remove(tag)
    current = {tag.id for tag in item_orm.tags}
    for tag_id, tag in desired.items():
        if tag_id not in current:
            item_orm.tags.append(tag)
```

When only the links changed, the parent's `version` would not bump on its own — force it with
`attributes.flag_modified(item_orm, "name")` so the optimistic lock still moves.

**Not used, deliberately:** upserts (`ON CONFLICT`), bulk `update()`/`delete()` statements, lazy
relationship loads, and raw SQL. Idempotency is achieved with an application-side pre-check, the way
`seed.py` does it.

---

## 5. Mapping domain ↔ ORM

Small private module-level functions in the repository file — never a method on the ORM model, never
on the domain model:

```python
def _to_domain(item_orm: ItemORM) -> Item:
    return Item(
        id=item_orm.id,
        name=item_orm.name,
        slug=item_orm.slug,
        description=item_orm.description,
        category=item_orm.category,
        owner_id=item_orm.owner_id,
        tag_names=[tag.name for tag in item_orm.tags],   # scalars only, never the ORM object
        version=item_orm.version,
    )


def _apply_fields(item_orm: ItemORM, item: Item) -> None:
    item_orm.name = item.name
    item_orm.slug = item.slug
    ...
```

`_apply_fields` deliberately does **not** touch `id` (immutable) or `version` (handled by
`set_committed_value`). Related rows are flattened here too: the domain model sees
`tag_names: list[str]`, never a `TagORM`. Read only scalar columns off the far side of a
`secondary` relationship — its own reverse collection is unloaded (see §2).

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
FK column has an index, that association tables kept their composite primary key, and that unique
constraints kept their `uq_…` name. Autogenerate gets the shape right and the names wrong; a
constraint that reaches production unnamed is one nobody can drop later without looking it up.

Adding a `NOT NULL` column to a populated table needs a `server_default` to backfill the existing
rows in one step.

Current history is a single initial revision, `d5d3e24a6992` (`down_revision = None`), which
creates `users` together with the example catalogue — `items`, `collections`, `tags` and the
`item_tags` / `item_collections` association tables. Its `downgrade()` drops them in reverse
dependency order: association tables first, then the entities they link, and `users` last because
`items.owner_id` points at it.

---

## 8. The seed script

`backend/seed.py` writes **only through the repositories**, never through the session or raw SQL,
so it can never drift from the persistence rules. It inserts in FK order, truncates values to the
ORM column lengths, hashes passwords with the production hasher, and is idempotent through a
pre-check on a fixed, reproducible identifier (`find_by_email` for users). Run it with `make seed`.

It currently seeds users only; populating the example catalogue is pending, and so is retiring the
names the previous sample domain left in it (issue #12).

Keep that contract when you extend it: new seed data goes through the repository for its entity.

---

## 9. Adding a new entity — checklist

1. **ORM model** — in `sqlalchemy_models.py` if the entity belongs to the template itself, in a new
   module under `persistence/example/` if it belongs to the sample catalogue. With lengths,
   indexes, named FKs and constraints, and `version_id_col` only if the aggregate needs optimistic
   locking.
2. **Migration**: `alembic revision --autogenerate`, review it, `alembic upgrade head`. An entity
   added under `example/` also needs its module re-exported from `example/__init__.py`, which is
   what registers the table on `Base.metadata` for autogenerate to see.
3. **Port** in `domain/ports/repositories.py` — only the methods the use case needs.
4. **Repository** in `adapters/outbound/persistence/<entity>_repository.py`, with its
   `_to_domain` / `_apply_fields` helpers, following the insert/update/delete patterns above. No
   inheritance from the Protocol.
5. **Wiring** in `config/container.py`.
6. **Integration tests** against the real database, using the `db_session` fixture from
   `tests/conftest.py` (a connection-scoped transaction rolled back at teardown).
7. **Unit tests** of the service that uses the port, against an in-memory fake honouring the same
   invariants — including optimistic locking, if the entity has a `version`.

---

## 10. What NOT to do

- No raw SQL: no `text()`, no f-string queries, no driver-level calls.
- No SQLAlchemy import outside `adapters/outbound/persistence/`, `config/`, `alembic/` and the
  tests.
- No import of `persistence/example/` from template code — the dependency runs example → template,
  never the other way, or the package stops being deletable.
- No lazy relationship loading — declare `lazy="selectin"`.
- No bulk `update()`/`delete()` statements; load and mutate.
- No `session.commit()` in a service or a router; the repository owns it.
- No `try/except IntegrityError` in a repository; the middleware handles it.
- No ORM instance returned to the domain, and no domain dataclass passed to `session.add()`.
- No `sa.Enum`; convert in the mapper.
- No credentials in code — the DSN is built by `settings.database_url` from environment variables.
