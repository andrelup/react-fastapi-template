# Backend Testing

How tests are written in `backend/`: pytest + pytest-asyncio + httpx, organised in three tiers that
mirror the hexagonal layers. This document describes the conventions the existing suite actually
follows, so a new test looks like the ones already there.

The suite covers authentication, the shared adapters, the middleware, the ORM metadata and the
`Item` slice — the catalogue's other entities (`collections`, `tags`) are still ORM models alone
(issue #37). Some scaffolding went with the old example domain and has not come back: there is no
`tests/factories.py` and no `tests/fakes/` package, because both are promoted from a test file only
when a second consumer appears, and `FakeItemRepository` still has exactly one. **The conventions
below outlive the files** — wherever a module is not there yet, this document says so rather than
pointing you at it.

Companion documents: [hexagonal architecture](./backend-hexagonal-architecture.md),
[database access](./backend-database-sqlalchemy.md), [code style](./backend-code-style.md).

---

## 1. Setup and commands

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["."]
```

`asyncio_mode = "auto"` means **you never write `@pytest.mark.asyncio`** — any `async def test_…`
is run as an asyncio test. No markers, no `testpaths` and no `addopts` are declared, so the
coverage flags are passed on the command line.

Run everything **from the repo root**:

```bash
make test-back
```

which expands to:

```bash
cd backend && ../.venv/Scripts/python.exe -m pytest --cov=src --cov-report=term-missing
```

(`../.venv/bin/python` on Linux and macOS — the Makefile picks the right one.)

`make test` runs both stacks: `test-back` followed by `test-front`. `make test-e2e` is separate,
because Playwright needs a running API and a seeded database.

The integration tier and most of the API tier talk to a **real PostgreSQL** — the one
`settings.database_url` points at, started by `make dev`. Run `make migrate` before the suite so
the schema exists. Nothing skips itself: if the database is unreachable, those tests fail rather
than silently pass.

---

## 2. The three tiers

| Tier | Location | Tests | Ports are… |
|---|---|---|---|
| **Unit** | `tests/unit/` | Domain services, security adapters with pure logic, schemas, the error handler, the logging config and middleware, settings, ORM metadata | **Fakes** — in-memory, hand-written |
| **Integration** | `tests/integration/` | SQLAlchemy repository implementations and real DB behaviour (unique constraints, optimistic locking) | **Real PostgreSQL** |
| **API** | `tests/api/` | Routers end to end: routing, validation, auth, error translation, envelope | **Real**, through a rolled-back session; `get_current_user` overridden when a test needs an identity |

The rule of thumb: **test each layer against the boundary it owns.** A domain rule is a unit test;
"does this SQL actually do what I think" is an integration test; "does a viewer get a 403 here"
is an API test.

The API tier drives the real app over `ASGITransport`, with `get_db_session` pointed at the test
transaction. Swapping a port for a fake there is legitimate when the endpoint's collaborator is
slow or external — override the provider from `config/container.py` inside the `client` fixture —
but it is not what the current tests do, and it is not the default.

---

## 3. Fakes, not mocks

There is **no `unittest.mock` anywhere in the suite** — no `Mock`, no `patch`. Ports are satisfied
by small hand-written in-memory classes backed by a `dict` and an auto-incrementing id.

The reason is important: a fake enforces the port's real contract. `FakeItemRepository.save()` in
`tests/unit/test_item_service.py` replicates optimistic locking exactly as PostgreSQL does —
comparing versions and raising the same `sqlalchemy.orm.exc.StaleDataError` — so a locking test that
passes against the fake asserts something real. A mock that just records calls would be green while
asserting nothing.

A fake enforcing the contract also means copying the real adapter's *aliasing*, not just its return
types. `SqlAlchemyItemRepository` builds a fresh domain object on every read, so the fake returns
copies too. Hand back the stored instance instead and a caller that mutates what it read is writing
straight into the store — the version check then compares an object with itself and the lock test
passes while asserting nothing. That one is written up in
[adding-a-feature.md](./adding-a-feature.md) §11.

**When you add a port, add its fake**, and make it honour the same invariants the real adapter
does.

Where the fake lives follows from who uses it:

- **Used by one module** → keep it local to that test file. That is the whole story today:
  `FakeUserRepository`, `FakePasswordHasher` and `FakeTokenService` at the top of
  `tests/unit/test_auth_service.py`, and `FakeItemRepository` at the top of
  `tests/unit/test_item_service.py`.
- **Shared by two or more** → promote it to a `tests/fakes/` package, one module per fake, and
  import it from both. That package does not exist right now; the first port with two consumers
  creates it. Do not create it empty in advance.

The same rule governs object mothers. A `make_<entity>()` helper that builds a valid domain object
with sensible defaults belongs next to its only user until a second one appears, at which point it
moves to `tests/factories.py` — a module that, likewise, does not exist yet.

---

## 4. Fixtures

### `tests/conftest.py` — global

| Fixture | Purpose |
|---|---|
| `db_connection` | An `AsyncConnection` to the **developer's dev database** inside an open transaction, rolled back at teardown. Requires `alembic upgrade head` to have been run. |
| `db_session` | An `AsyncSession` bound to it with `join_transaction_mode="create_savepoint"`, so a repository's `commit()` only releases a SAVEPOINT and the outer transaction is still rolled back. |
| `async_client` | `httpx.AsyncClient` against the real app, with `get_db_session` overridden to the isolated session. |

Those three are the whole file. There are no shared `User` fixtures: a test that needs an `editor`
or a `viewer` builds the `User` it wants in its own Arrange step, which keeps the roles and ids
visible right where the assertion depends on them.

```python
@pytest_asyncio.fixture
async def db_session(db_connection: AsyncConnection) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        bind=db_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    async with session_factory() as session:
        yield session
```

### `tests/api/conftest.py` — API tier

| Fixture | Purpose |
|---|---|
| `client` | A DB-agnostic `httpx.AsyncClient` with no overrides, for health, CORS and logging tests. |
| `authenticated_as` | A callable that overrides `get_current_user` to return the `User` you pass it. |

```python
authenticated_as(user)   # overrides get_current_user to return that user
```

Call it to authenticate; skip it to test the 401 path — `get_current_user` is left un-overridden by
default, so a test that never calls it exercises the real JWT dependency.

This is also where a fake repository and its service would go if the API tier ever needed one: add
the fixture here and override the matching `get_*_service` provider inside `client`.

### Integration tier — no conftest of its own

`tests/integration/` has no `conftest.py`: its tests take the global `db_session` directly, so they
run against the developer's dev database inside a transaction that is rolled back at teardown.
`alembic upgrade head` must have been run first.

If a tier-specific fixture is ever needed there, name it **per entity** — `item_db_session`, not
`db_session` — so it cannot shadow the global fixture for the whole directory. The same applies to
a pair of independent sessions on one engine, which is how a test proves that concurrent writes
raise `StaleDataError`.

---

## 5. Conventions

- **File naming:** `test_<subject>.py`, one file per service, repository, router or concern.
- **Function naming:** `test_<method>_<scenario>_<expected_result>`, e.g.
  `test_update_when_version_is_stale_raises_stale_data_error`. Followed without exception.
- **Everything in English** — names, docstrings and comments.
- **AAA with comments, genuinely used:** `# Arrange` / `# Act` / `# Assert`, collapsed to
  `# Act / Assert` when the action is the `pytest.raises` block itself. Comments often carry a short
  explanation after a dash: `# Assert - the response carries the new version, which the client must send next time.`
- **Type annotations everywhere**, including `-> None` on every test function; mypy strict applies.
- **Exceptions:** always `with pytest.raises(SpecificDomainError):` — never bare `Exception`. Add
  `match=` when the message matters.
- **HTTP assertions:** check `response.status_code` first, then unpack `response.json()` and assert
  the envelope — `success` is `True`/`False`, `data` is `None` on errors, `error` carries the
  message.
- **`parametrize` sparingly**, only for genuinely table-shaped cases (invalid-field combinations,
  exception→status mapping).
- **Sync tests for sync code.** The hasher, the JWT service, the schemas, the settings, the logging
  configuration and the ORM metadata are tested with plain `def test_…`.

---

## 6. Templates

These are shapes to copy, not imports to trust: `SomethingService` stands in for the service you
are actually testing.

### Unit test of a domain service

```python
import pytest

from src.domain.exceptions import ForbiddenError
from src.domain.models.something import Something
from src.domain.models.user import User, UserRole
from src.domain.services.something_service import SomethingService


class FakeSomethingRepository:
    """In-memory `SomethingRepository`, honouring the same invariants as the real one."""

    def __init__(self) -> None:
        self._rows: dict[int, Something] = {}
        self._next_id = 1

    ...


@pytest.fixture
def sut() -> SomethingService:
    return SomethingService(FakeSomethingRepository())


def _user(role: UserRole, user_id: int = 1) -> User:
    return User(
        id=user_id,
        email=f"{role.value}-{user_id}@example.com",
        name="Test User",
        role=role,
        hashed_password="hashed",
    )


def _make_something() -> Something:
    """Object mother: a valid entity with sensible defaults."""
    return Something(name="Example")


async def test_create_when_valid_returns_saved_entity(sut: SomethingService) -> None:
    # Arrange
    owner = _user(UserRole.EDITOR)
    entity = _make_something()

    # Act
    created = await sut.create(owner, entity)

    # Assert
    assert created.id is not None
    assert created.owner_id == owner.id


async def test_create_when_role_is_not_allowed_raises_forbidden(sut: SomethingService) -> None:
    # Arrange
    intruder = _user(UserRole.VIEWER, user_id=2)
    entity = _make_something()

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.create(intruder, entity)
```

Both the fake and `_make_something()` are the local-until-shared case from §3: they live in this
module, private, until a second test file needs them — then they move to `tests/fakes/` and
`tests/factories.py` respectively, and lose the leading underscore.

### Integration test of a repository

```python
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapters.outbound.persistence.something_repository import SqlAlchemySomethingRepository


async def test_save_when_new_entity_persists_and_assigns_id(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemySomethingRepository(db_session)
    entity = _make_something()

    # Act
    saved = await sut.save(entity)

    # Assert
    assert saved.id is not None
    assert saved.name == entity.name


async def test_find_by_id_when_missing_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemySomethingRepository(db_session)

    # Act
    found = await sut.find_by_id(999)

    # Assert
    assert found is None
```

The global `db_session` is enough for most repositories. An entity whose rows need a foreign-key
parent seeds it in the Arrange step, through the parent's repository — the same rule the seed
script follows. Only introduce a `tests/integration/conftest.py` when several modules need the
same setup, and name its fixtures per entity (§4).

### API endpoint test

```python
import httpx

_VALID_PAYLOAD = {"name": "Example"}


async def test_create_something_when_authenticated_returns_201(
    async_client: httpx.AsyncClient,
) -> None:
    # Arrange - register and log in through the real endpoints, so the test
    # exercises the same path a client would.
    token = await _register_and_login(async_client)

    # Act
    response = await async_client.post(
        "/somethings", json=_VALID_PAYLOAD, headers={"Authorization": f"Bearer {token}"}
    )

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None


async def test_create_something_when_no_credentials_returns_401(
    async_client: httpx.AsyncClient,
) -> None:
    # Act - no Authorization header, so the real dependency rejects the request.
    response = await async_client.post("/somethings", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 401
```

Use `async_client` when the endpoint touches the database, and the DB-agnostic `client` when it
does not. When wiring a real login is more ceremony than the test is worth, take `authenticated_as`
from `tests/api/conftest.py` and hand it the `User` you want.

---

## 7. What to test for a new use case

A new endpoint is not done until all three tiers cover it:

- **Unit** — the happy path, every validation failure, and every authorization rule (wrong role,
  not the owner, resource missing).
- **Integration** — persistence round-trip, `find_by_id` on a missing row, unique-constraint
  behaviour, and concurrent-write conflict if the entity is versioned.
- **API** — success with the right status code and envelope, 401 without credentials, 403 for the
  wrong role, 404 for a missing resource, 422 for an invalid payload, 409 for a conflict.

---

## 8. Coverage and the gate

The project minimum is **80 %**, and it is enforced rather than trusted. Read the `term-missing`
report from `make test-back` and add cases for the uncovered lines of anything you touched.

Where the enforcement lives, so you do not go looking for it in the wrong place:

- **`backend/pyproject.toml`.** `[tool.coverage.run]` measures `src/` only, omitting `alembic/` and
  `seed.py`; `[tool.coverage.report] fail_under = 80` makes any `--cov` run exit non-zero below the
  threshold. The config is the gate — no `--cov-fail-under` is passed on the command line, so local
  and CI fail identically. Never lower it; add tests.
- **CI**, in `.github/workflows/ci-backend.yml`: a `lint` job (`ruff check`, `ruff format --check`,
  `mypy --strict`) and a `test-backend` job that brings up a PostgreSQL service, runs
  `alembic upgrade head`, then `pytest --cov=src`. A `paths:` filter keeps a frontend-only PR from
  running it.
- **The pre-commit mypy hook only covers `backend/src/`**, not the tests — its `files:` filter says
  so. `make lint` and CI both run `mypy` over the whole of `backend/`, tests included, so a type
  error in a test surfaces there rather than at commit time. Run `make lint` before pushing.

---

## 9. Checklist

- [ ] Tests added at every tier the change touches.
- [ ] `test_<method>_<scenario>_<expected_result>` naming, in English.
- [ ] AAA comments present; annotations complete (`-> None`).
- [ ] Ports faked, not mocked; a new port got a fake honouring its invariants.
- [ ] A fake or object mother used by a second module was promoted out of the test file, not
      copy-pasted.
- [ ] Domain exceptions asserted specifically with `pytest.raises`.
- [ ] HTTP tests assert status code **and** the `{success, data, error}` envelope.
- [ ] `make test-back` and `make lint` both pass; coverage at or above 80 %.
