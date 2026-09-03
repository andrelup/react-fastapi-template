# Backend Testing

How tests are written in `backend/`: pytest + pytest-asyncio + httpx, organised in three tiers that
mirror the hexagonal layers. This document describes the conventions the existing 174 tests
actually follow, so a new test looks like the ones already there.

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
is run as an asyncio test. No markers, no `testpaths` and no `addopts` are declared, so coverage
flags are passed on the command line.

Run everything **from the repo root**:

```bash
make test-back
```

which expands to:

```bash
.venv/Scripts/python.exe -m pytest backend -c backend/pyproject.toml \
    -o cache_dir=../.pytest_cache --cov=backend/src --cov-report=term-missing
```

`make test` is currently an alias for the backend suite. Integration tests need **Docker** running;
the tier skips itself if Docker is unavailable.

---

## 2. The three tiers

| Tier | Location | Tests | Ports are… |
|---|---|---|---|
| **Unit** | `tests/unit/` | Domain services, security adapters with pure logic, schemas, exceptions, the error handler, settings | **Fakes** — in-memory, hand-written |
| **Integration** | `tests/integration/` | SQLAlchemy repository implementations and real DB behaviour (optimistic locking) | **Real PostgreSQL** |
| **API** | `tests/api/` | Routers end to end: routing, validation, auth, error translation, envelope | **Fakes**, injected via `dependency_overrides` |

The rule of thumb: **test each layer against the boundary it owns.** A domain rule is a unit test;
"does this SQL actually do what I think" is an integration test; "does a customer get a 403 here"
is an API test.

---

## 3. Fakes, not mocks

There is **no `unittest.mock` anywhere in the suite** — no `Mock`, no `patch`. Ports are satisfied
by small hand-written in-memory classes in `tests/fakes/`, backed by a `dict` and an
auto-incrementing id.

The reason is important: a fake enforces the port's real contract. `FakeBookRepository.save()`
replicates optimistic locking exactly as PostgreSQL does — comparing versions and raising the same
`sqlalchemy.orm.exc.StaleDataError` — so a locking test that passes against the fake is asserting
something real. A mock that just records calls would be green while asserting nothing.

**When you add a port, add its fake**, and make it honour the same invariants the real adapter
does. Reuse it in both the unit tests and the API tests — the API conftest injects the very same
fakes, so there is no duplicated test double.

Very small, single-use fakes (`FakeUserRepository`, `FakePasswordHasher`, `FakeTokenService` in
`test_auth_service.py`) may stay local to the test module.

---

## 4. Fixtures

### `tests/conftest.py` — global

| Fixture | Purpose |
|---|---|
| `db_connection` | An `AsyncConnection` to the **developer's dev database** inside an open transaction, rolled back at teardown. Requires `alembic upgrade head` to have been run. |
| `db_session` | An `AsyncSession` bound to it with `join_transaction_mode="create_savepoint"`, so a repository's `commit()` only releases a SAVEPOINT and the outer transaction is still rolled back. |
| `async_client` | `httpx.AsyncClient` against the real app, with `get_db_session` overridden to the isolated session. |
| `seller_user`, `other_seller_user`, `customer_user`, `other_customer_user` | Plain `User` domain objects with fixed ids and roles, for authorization scenarios (owner vs. other seller, customer vs. seller). |
| `client` | A DB-agnostic `httpx.AsyncClient` with no overrides, for health and CORS tests. |

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

Provides the fake repositories, the services wired to them, and a `client` fixture (shadowing the
global one) whose `get_*_service` dependencies are overridden. Plus:

```python
authenticated_as(user)   # overrides get_current_user to return that user
```

Call it to authenticate; skip it to test the 401 path.

### `tests/integration/conftest.py` — integration tier

Spins up a **throwaway `postgres:16-alpine` Docker container** once per session, and per test
creates the schema from `Base.metadata`, seeds the rows needed to satisfy foreign keys, yields a
session, then drops everything.

Fixtures are deliberately named per entity — `book_db_session`, `favourite_db_session` — **not**
`db_session`, so they do not shadow the global fixture for the whole directory. Keep that
convention when you add one.

`two_book_sessions` / `two_favourite_sessions` return two independent sessions on the same engine,
used to prove that concurrent writes raise `StaleDataError`.

---

## 5. Conventions

- **File naming:** `test_<subject>.py`, one file per service, repository, router or concern.
- **Function naming:** `test_<method>_<scenario>_<expected_result>`, e.g.
  `test_update_when_version_is_stale_raises_stale_data_error`. Followed by all 174 tests.
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
- **Sync tests for sync code.** The hasher, the JWT service, the schemas and the exceptions are
  tested with plain `def test_…`.

---

## 6. Templates

### Unit test of a domain service

```python
import pytest

from src.domain.exceptions import ForbiddenError
from src.domain.models.user import User
from src.domain.services.something_service import SomethingService
from tests.factories import make_something
from tests.fakes.fake_something_repository import FakeSomethingRepository


@pytest.fixture
def sut() -> SomethingService:
    return SomethingService(FakeSomethingRepository())


async def test_create_when_valid_returns_saved_entity(
    sut: SomethingService, customer_user: User
) -> None:
    # Arrange
    entity = make_something()

    # Act
    created = await sut.create(customer_user, entity)

    # Assert
    assert created.id is not None
    assert created.owner_id == customer_user.id


async def test_create_when_seller_attempts_raises_forbidden(
    sut: SomethingService, seller_user: User
) -> None:
    # Arrange
    entity = make_something()

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.create(seller_user, entity)
```

### Integration test of a repository

```python
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapters.outbound.persistence.something_repository import SqlAlchemySomethingRepository
from tests.factories import make_something


async def test_save_when_new_entity_persists_and_assigns_id(
    something_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemySomethingRepository(something_db_session)
    entity = make_something()

    # Act
    saved = await sut.save(entity)

    # Assert
    assert saved.id is not None
    assert saved.name == entity.name


async def test_find_by_id_when_missing_returns_none(something_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemySomethingRepository(something_db_session)

    # Act
    found = await sut.find_by_id(999)

    # Assert
    assert found is None
```

A new repository needs its own session fixture in `tests/integration/conftest.py`, following the
`book_db_session` pattern: create the schema, seed the FK parents, yield, drop.

### API endpoint test

```python
from collections.abc import Callable

import httpx

from src.domain.models.user import User

_VALID_PAYLOAD = {"name": "Example"}


async def test_create_something_when_customer_returns_201(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    response = await client.post("/somethings", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    assert body["data"]["owner_id"] == customer_user.id


async def test_create_something_when_no_credentials_returns_401(client: httpx.AsyncClient) -> None:
    # Act - authenticated_as was never called, so the real dependency runs
    # against a request with no token.
    response = await client.post("/somethings", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 401
```

If the endpoint's port needs faking, add the `fake_*_repository` and `*_service` fixtures to
`tests/api/conftest.py` and override the provider inside the `client` fixture.

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

The project minimum is **80 %**. Read the `term-missing` report from `make test-back` and add cases
for the uncovered lines of anything you touched.

Be aware of what is **not** automated today, so you do not rely on it:

- There is **no `--cov-fail-under`** and no coverage config, so `make test-back` exits 0 regardless
  of the percentage. The 80 % rule is upheld by you, not by the tool.
- There is **no CI pipeline** (`.github/workflows/` does not exist). Everything is enforced locally
  by the pre-commit hooks plus discipline.
- The pre-commit **mypy hook only covers `backend/src/`**, not the tests. `make lint` covers both —
  run it.

---

## 9. Checklist

- [ ] Tests added at every tier the change touches.
- [ ] `test_<method>_<scenario>_<expected_result>` naming, in English.
- [ ] AAA comments present; annotations complete (`-> None`).
- [ ] Ports faked, not mocked; a new port got a fake honouring its invariants.
- [ ] Domain exceptions asserted specifically with `pytest.raises`.
- [ ] HTTP tests assert status code **and** the `{success, data, error}` envelope.
- [ ] `make test-back` and `make lint` both pass; coverage at or above 80 %.
