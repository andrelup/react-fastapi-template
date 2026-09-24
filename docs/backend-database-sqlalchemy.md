# Backend — Database Access with SQLAlchemy

All persistence goes through **SQLAlchemy 2.0 async**, always. There is no raw SQL anywhere in
`src/` and there must not be: no `text()`, no string-built queries, no direct driver calls. Reads
and writes happen exclusively inside the repository adapters in
`adapters/outbound/persistence/`, which are the only modules in the project allowed to import
SQLAlchemy alongside `config/` and the migrations.

Examples below use a neutral vocabulary — `Review`, an owned and versioned aggregate; `Topic`, an
ownerless one it links to; `Label`, a tag-like row resolved by name. They illustrate shapes, not
files: none of them exists here. `UserORM` is the exception and is named where it appears, because
it is real template code that survives any deletion of the sample domain.

Companion documents: [hexagonal architecture](./backend-hexagonal-architecture.md),
[code style](./backend-code-style.md), [testing](./backend-testing.md),
[the example domain](./the-example-domain.md).

---

## 1. The three-layer split

| | Where | What it is |
|---|---|---|
| Domain model | `domain/models/<entity>.py` | plain `@dataclass`, no SQLAlchemy |
| ORM model | `adapters/outbound/persistence/sqlalchemy_models.py` (`Base`, `UserORM`) | `DeclarativeBase` + `Mapped[...]` |
| Mapping | `adapters/outbound/persistence/<entity>_repository.py` | module-level `_to_domain` / `_apply_fields` |

The ORM layer is split in two. `sqlalchemy_models.py` holds what belongs to the template itself —
the shared `Base` and `UserORM`. Anything belonging to the removable sample lives in an `example/`
package instead, under the same rules; see [the example domain](./the-example-domain.md).

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
class ReviewORM(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", name="fk_reviews_owner_id_users"),
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
  `ForeignKey("users.id", ondelete="CASCADE", name="fk_reviews_owner_id_users")`, plus `index=True`
  on the column. Rows that must disappear with their parent declare `ondelete="CASCADE"` **on the
  foreign key**, not only on the Python-side relationship.
- **A foreign key does not imply a relationship.** Add a `relationship()` only when a use case
  actually navigates the association; otherwise resolve by id and keep the two modules independent.
  This is not only a taste preference — a `relationship()` makes the referenced module depend on the
  referencing one, which is what stops a removable package from being removable.
- **No `sa.Enum`.** `UserORM.role` is a plain `String(20)`; the domain `UserRole` enum is converted
  in the mapper (`UserRole(user_orm.role)` inbound, `user.role.value` outbound). A closed set of
  values on any new entity follows the same rule.
- **Relationships**, where a use case does navigate them, are declared on both sides with
  `back_populates`:

  ```python
  labels: Mapped[list["LabelORM"]] = relationship(
      secondary=review_labels_table,
      back_populates="reviews",
      lazy="selectin",
      order_by="LabelORM.name",
  )
  ```

  `lazy="selectin"` because a lazy load inside async code is a trap; an explicit `order_by` so
  results are deterministic. **No `cascade="all, delete-orphan"` on a `secondary` relationship** —
  it would delete the far-side row instead of the association row. Cleaning up link rows is the
  foreign key's `ondelete="CASCADE"` job, which is also what guarantees that deleting one side of a
  many-to-many leaves the other side's rows alive.

  Two mutual `lazy="selectin"` relationships stop eager-loading after one hop: the `LabelORM.reviews`
  reached from a review comes back *unloaded*, and touching it falls back to a lazy load, which is
  `MissingGreenlet` under asyncio. A mapper may read scalar columns off the far side (`label.name`)
  but never its reverse collection.

### One parent, many children

A 1:N association is the same bare foreign key on the child table, pointing at the parent. Whether
the parent gets a `relationship()` back is the question above: if no use case reads a parent's
children, it does not need one, and adding it couples the two modules for nothing.

No entity in this repository has a 1:N `relationship()` today — every association here is either a
bare foreign key or a `secondary` many-to-many — so treat the paragraph above as derivation from the
stated rules rather than as precedent.

### Association tables

A link table that carries no columns of its own beyond the two foreign keys is a bare `Table`, not
a mapped class — a class would be noise:

```python
review_labels_table = Table(
    "review_labels",
    Base.metadata,
    Column(
        "review_id",
        Integer,
        ForeignKey("reviews.id", ondelete="CASCADE", name="fk_review_labels_review_id_reviews"),
        primary_key=True,
    ),
    Column(
        "label_id",
        Integer,
        ForeignKey("labels.id", ondelete="CASCADE", name="fk_review_labels_label_id_labels"),
        primary_key=True,
        index=True,
    ),
)
```

The two foreign keys are the composite primary key — no surrogate `id`. Only the **trailing** key
column gets its own `index=True`: the leading one already rides the composite primary key index,
while the trailing one needs an index of its own so the FK's `ON DELETE CASCADE` and the reverse
lookup do not fall back to a sequential scan. The table lives in the module of the entity it hangs
off the parent.

### Unique constraints

| Need | Declaration |
|---|---|
| Single column, uniqueness only | `mapped_column(..., unique=True)` → a `UNIQUE` constraint |
| Single column, also frequently filtered | `mapped_column(..., unique=True, index=True)` → a **unique index** |
| Composite, or any constraint whose name must be explicit | a named `UniqueConstraint` in `__table_args__` |

```python
__table_args__ = (UniqueConstraint("name", name="uq_topics_name"),)
```

Choose by how the column is *read*, not by how it is constrained. A name that is only ever kept
unique — never looked up by value — takes the third form, because a unique index would be weight
nobody queries. A slug that is both unique and fetched by value takes the second.

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
`StaleDataError` when no row matches. Give it to an aggregate a client can edit; leave it off rows
nothing edits concurrently — `UserORM` has none.

The column is one of **three** cooperating pieces, and the other two are in §4. On its own it does
nothing: the write path has to compare against the version the *caller* read, and a change that
touches no column of the parent row has to be forced to emit an UPDATE at all.

The version travels out to the client in the response schema and must come back on the next write.

### Timestamps and soft deletes

Neither exists anywhere in this schema. Both are ordinary columns, but both leak into every query,
every mapper and every response schema, so they are a project-wide decision rather than a per-entity
one. Decide once, or not at all.

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
review_orm = await self._session.get(ReviewORM, review_id)
return _to_domain(review_orm) if review_orm is not None else None
```

**Paginated list.** Decide once per project whether the repository takes a 1-indexed `page` and
computes the offset, or takes a pre-computed `offset` and lets the router do the arithmetic. Both
work; two ports in the same codebase disagreeing about it is what reads as an accident. Whichever
you pick, return the page **and** the total together — asking for the count in a second call means
counting a table that may have moved underneath:

```python
stmt = select(ReviewORM).order_by(ReviewORM.id).offset(offset).limit(limit)
result = await self._session.execute(stmt)
total = (await self._session.execute(select(func.count()).select_from(ReviewORM))).scalar_one()
return [_to_domain(row) for row in result.scalars().all()], total
```

**Filter reused by a search/count pair** — factor the predicate into one helper so the two queries
can never drift. Type it `Select[tuple[Any, ...]]` when the same helper decorates both the row query
and the count query, which select different things:

```python
@staticmethod
def _filtered(
    statement: Select[tuple[Any, ...]], query: str | None, status: str | None
) -> Select[tuple[Any, ...]]:
    if query:
        pattern = f"%{query}%"
        statement = statement.where(
            or_(ReviewORM.title.ilike(pattern), ReviewORM.body.ilike(pattern))
        )
    if status:
        statement = statement.where(ReviewORM.status == status)
    return statement
```

**Unique lookup by a non-PK column** — `scalar_one_or_none()`:

```python
result = await self._session.execute(select(UserORM).where(UserORM.email == email))
user_orm = result.scalar_one_or_none()
```

Multiple predicates in one `.where(a, b)` are ANDed.

**Insert** — build the ORM object, `add`, `commit`, `refresh`:

```python
review_orm = ReviewORM(title=review.title, slug=review.slug, ...)
self._session.add(review_orm)
await self._session.commit()
await self._session.refresh(review_orm)
return _to_domain(review_orm)
```

**Update** — unit-of-work style: load the row, mutate attributes, commit. **Never** a bulk
`update()` statement:

```python
review_orm = await self._session.get(ReviewORM, review.id)
if review_orm is None:
    raise ValueError(f"Cannot update review {review.id}: it does not exist")
attributes.set_committed_value(review_orm, "version", review.version)
_apply_fields(review_orm, review)
await self._session.commit()
await self._session.refresh(review_orm)
```

**`set_committed_value` is the second of the three locking pieces, and it is load-bearing.**
`session.get()` re-reads the row, so the ORM's idea of "the version I loaded" becomes whatever is in
the database right now — not what the client read. The generated `WHERE version = :v` would then
always match, and the lost update the lock exists to catch goes through silently. Overwriting it
with the caller's version is what makes `StaleDataError` fire. Keep it.

**Delete** — load, delete, commit; a missing row is a no-op:

```python
review_orm = await self._session.get(ReviewORM, review_id)
if review_orm is not None:
    await self._session.delete(review_orm)
    await self._session.commit()
```

### Reconciling a linked collection

Make the collection match what was asked for, **in place**. Never clear and refill: the unchanged
association rows should keep their identity. Return whether anything actually moved — the caller
needs it, as the next section explains:

```python
async def _reconcile_labels(self, review_orm: ReviewORM, names: list[str]) -> bool:
    """Make `review_orm.labels` match `names`, preserving the links that stay."""
    desired = set(names)
    current = {label.name for label in review_orm.labels}
    if desired == current:
        return False

    for label in list(review_orm.labels):
        if label.name not in desired:
            review_orm.labels.remove(label)
    for name in desired - current:
        review_orm.labels.append(await self._get_or_create_label(name))
    return True
```

**How the far side is resolved is a design decision, not a detail.** There are two shapes, and
choosing the wrong one has consequences beyond persistence:

- **By natural key, creating on demand** — the tag-like case. The caller sends `["draft"]`, not ids,
  and a name nobody has used before is created:

  ```python
  result = await self._session.execute(select(LabelORM).where(LabelORM.name == name))
  label_orm = result.scalar_one_or_none()
  if label_orm is None:
      label_orm = LabelORM(name=name)
      self._session.add(label_orm)
  return label_orm
  ```

  Deliberately **not** wrapped in `try/except IntegrityError`: two concurrent saves introducing the
  same new name race on the unique constraint, and the loser's error is allowed through to become a
  409. Deciding what a conflict means is the domain's job, not the repository's.

- **By id, and it must already exist** — when creating the far-side row is a privilege the caller
  may not have. The service validates the ids and raises its own not-found error before the
  repository is reached, so here a plain `session.get` suffices. Reaching for get-or-create in this
  case would quietly grant a permission the authorization matrix withholds.

### Forcing the version when only links moved

A request that changes only a linked collection touches no column on the parent row, so SQLAlchemy
emits no UPDATE on it and the version does not advance. Two clients could then both re-link from the
same version and neither would notice. Marking any column dirty forces the UPDATE, and with it the
bump — **the third locking piece**:

```python
with self._session.no_autoflush:
    labels_changed = await self._reconcile_labels(review_orm, review.label_names)
    topics_changed = await self._reconcile_topics(review_orm, review.topics)
if review.id is not None and (labels_changed or topics_changed):
    attributes.flag_modified(review_orm, "title")
```

Three things in there are load-bearing, and every one of them is a version that comes back wrong by
exactly one — which reaches the next caller as a conflict they cannot explain:

- **`review.id is not None`** — an INSERT already writes version 1. Flagging the row there appends a
  gratuitous UPDATE to the same flush, and a brand-new row with links is born at version 2.
- **the combined `changed` flag** — this is why `_reconcile_*` returns a bool. Forcing an UPDATE
  when nothing moved bumps the version on a no-op save. And when an aggregate owns **two** linked
  collections, the flag fires **once** on the union of both results: two independently guarded calls
  are two extra UPDATEs in the same flush, the same off-by-one arriving through a different door.
- **`no_autoflush` around the whole reconciliation** — resolving a far-side row runs a SELECT, and
  the autoflush it triggers writes the pending scalar changes as their own UPDATE, one version bump,
  before `flag_modified` forces a second. A plain rename with links attached would advance the
  version by two.

One caveat for whoever writes the test: **"reconcile, do not recreate" cannot be asserted directly.**
A bare association table has nothing but its two key columns — no surrogate id, no timestamp,
nothing whose identity survives a delete-and-reinsert. Pin it the way the suite already does, by
performing an add and a remove in the same save and asserting the resulting membership set.

**Not used, deliberately:** upserts (`ON CONFLICT`), bulk `update()`/`delete()` statements, lazy
relationship loads, and raw SQL. Idempotency is achieved with an application-side pre-check, the way
`seed.py` does it.

---

## 5. Mapping domain ↔ ORM

Small private module-level functions in the repository file — never a method on the ORM model, never
on the domain model:

```python
def _to_domain(review_orm: ReviewORM) -> Review:
    return Review(
        id=review_orm.id,
        title=review_orm.title,
        slug=review_orm.slug,
        body=review_orm.body,
        status=review_orm.status,
        owner_id=review_orm.owner_id,
        label_names=[label.name for label in review_orm.labels],  # scalars only, never the ORM object
        version=review_orm.version,
    )


def _apply_fields(review_orm: ReviewORM, review: Review) -> None:
    review_orm.title = review.title
    review_orm.slug = review.slug
    ...
```

`_apply_fields` deliberately does **not** touch `id` (immutable) or `version` (handled by
`set_committed_value`). Related rows are flattened here too: the domain model sees a list of names,
or of small frozen reference objects carrying an id and a label — never an ORM instance. Read only
scalar columns off the far side of a `secondary` relationship; its own reverse collection is
unloaded (see §2).

---

## 6. Integrity errors

Two layers, covering two different failure windows:

1. **A business pre-check in the service.** `AuthService` calls `find_by_email` and raises
   `DuplicateEmailError` before writing. This produces a specific, well-worded error for the normal
   case. Run the pre-check only when the value actually changed — re-checking an unchanged unique
   column finds the row itself and reports a conflict with nobody.
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

**First check whether you need a revision at all.** A table may already exist, created with the
project's foundations long before the slice that finally uses it. Then the step is to *prove* the
diff is empty: run `alembic revision --autogenerate`, read the generated file, confirm both
`upgrade()` and `downgrade()` bodies are just `pass`, and delete it. An autogenerate run you throw
away is a legitimate outcome, and a far better one than a redundant revision nobody can safely
downgrade.

**Always read the generated migration before applying it.** Autogenerate is a starting point:
check that foreign keys are explicitly named following `fk_<table>_<column>_<ref_table>`, that every
FK column has an index, that association tables kept their composite primary key, and that unique
constraints kept their `uq_…` name. Autogenerate gets the shape right and the names wrong; a
constraint that reaches production unnamed is one nobody can drop later without looking it up.

Two more things it gets wrong often enough to check every time: server defaults it cannot see, and
the drop order in `downgrade()` when foreign keys are involved — association tables first, then the
entities they link, and the table they all point at last.

Adding a `NOT NULL` column to a populated table needs a `server_default` to backfill the existing
rows in one step.

Current history is a single initial revision, `d5d3e24a6992` (`down_revision = None`), which creates
`users` together with the sample domain's tables. Removing the sample means editing that revision,
not deleting a file; the procedure is in [the example domain](./the-example-domain.md).

---

## 8. The seed script

`backend/seed.py` writes **only through the repositories**, never through the session or raw SQL,
so it can never drift from the persistence rules. It inserts in FK order, truncates values to the
ORM column lengths, hashes passwords with the production hasher, and is idempotent through a
pre-check on a fixed, reproducible identifier (`find_by_email` for users). Run it with `make seed`.

It currently seeds users only, and no account with the top role, which is worth knowing before
trying to exercise an admin-only endpoint by hand (issue #12).

Keep that contract when you extend it: new seed data goes through the repository for its entity.

---

## 9. Adding a new entity — checklist

1. **ORM model** — in `sqlalchemy_models.py` if the entity belongs to the project itself, in its own
   module under a removable package if it belongs to a sample. With lengths, indexes, named FKs and
   constraints, and `version_id_col` only if the aggregate needs optimistic locking.
2. **Migration**: `alembic revision --autogenerate`, review it, `alembic upgrade head` — unless the
   table already exists, in which case prove the diff is empty and throw the file away. A model in a
   removable package also needs re-exporting from that package's `__init__.py`, which is what
   registers the table on `Base.metadata` for autogenerate to see.
3. **Port** in `domain/ports/` — only the methods the use case needs.
4. **Repository** in `adapters/outbound/persistence/<entity>_repository.py`, with its
   `_to_domain` / `_apply_fields` helpers, following the insert/update/delete patterns above. No
   inheritance from the Protocol.
5. **Wiring** in `config/container.py` — and note that a provider pointing at a module you have not
   written yet fails collection for the **entire** test session, not just its own tier.
6. **Integration tests** against the real database, using the `db_session` fixture from
   `tests/conftest.py` (a connection-scoped transaction rolled back at teardown).
7. **Unit tests** of the service that uses the port, against an in-memory fake honouring the same
   invariants — including optimistic locking, if the entity has a `version`.

---

## 10. What NOT to do

- No raw SQL: no `text()`, no f-string queries, no driver-level calls.
- No SQLAlchemy import outside `adapters/outbound/persistence/`, `config/`, `alembic/` and the
  tests.
- No import of a removable sample package from template code — the dependency runs sample →
  template, never the other way, or the package stops being deletable.
- No lazy relationship loading — declare `lazy="selectin"`.
- No bulk `update()`/`delete()` statements; load and mutate.
- No `session.commit()` in a service or a router; the repository owns it.
- No `try/except IntegrityError` in a repository; the middleware handles it.
- No ORM instance returned to the domain, and no domain dataclass passed to `session.add()`.
- No `sa.Enum`; convert in the mapper.
- No credentials in code — the DSN is built by `settings.database_url` from environment variables.
