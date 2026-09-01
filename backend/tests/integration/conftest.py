"""Fixtures for repository integration tests.

Spins up a throwaway PostgreSQL container via the Docker CLI so
`SqlAlchemyBookRepository` is exercised against a real database, per the
project's testing conventions (`backend/CLAUDE.md`: "Integración: usar DB
real de test"). If Docker is unavailable, these tests are skipped rather
than failed, so the rest of the suite is unaffected.

The container is fully isolated from any other BookShelf environment: it
uses its own name and host port, distinct from `infra/docker-compose.yml`'s
`bookshelf-postgres` service, so it never collides with a developer's (or
another agent's) locally running stack.

IMPORTANT: the fixture below is named `book_db_session`, not `db_session`,
on purpose. The top-level `tests/conftest.py` (from feature/auth-jwt)
already defines a `db_session` fixture (a transaction-per-test session
against the real, already-migrated dev database configured via `.env`),
used by `tests/integration/test_user_repository.py`. Since this conftest
lives closer to the test files under `tests/integration/`, a same-named
fixture here would silently shadow that one for every test in this
directory — including the unrelated user-repository tests.
"""

import shutil
import subprocess
import time
from collections.abc import AsyncGenerator, Generator

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from src.adapters.outbound.persistence.sqlalchemy_models import Base, BookORM, UserORM

_CONTAINER_NAME = "bookshelf-books-crud-test-db"
_HOST_PORT = 55433
# Throwaway password for an ephemeral, local-only test container torn down
# at the end of the test session — not a real secret.
_TEST_PASSWORD = "test_password"  # noqa: S105
_DATABASE_URL = f"postgresql+asyncpg://postgres:{_TEST_PASSWORD}@localhost:{_HOST_PORT}/postgres"

# `books.seller_id` has a physical FK to `users.id` (see the create_books_table
# migration). `tests.factories.make_book` defaults to this id, so a matching
# user row must exist before any book can be inserted.
DEFAULT_SELLER_ID = 1

# `favourite_list_items.book_id` has a physical FK to `books.id`, and
# `favourite_lists.owner_id` to `users.id`. The favourite fixture seeds one of
# each with these ids so a list (and its items) can be inserted.
DEFAULT_OWNER_ID = 1
DEFAULT_BOOK_ID = 1

# A second catalog book, seeded alongside `DEFAULT_BOOK_ID` by the two-session
# fixtures below so two concurrent writers can each add a *different* book to
# the same favourite list without colliding on the same item row.
SECOND_BOOK_ID = 2


def _docker_available() -> bool:
    return shutil.which("docker") is not None


def _wait_until_ready(timeout_seconds: float = 30.0) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        probe = subprocess.run(
            ["docker", "exec", _CONTAINER_NAME, "pg_isready", "-U", "postgres"],
            capture_output=True,
            check=False,
        )
        if probe.returncode == 0:
            return True
        time.sleep(0.5)
    return False


@pytest.fixture(scope="session")
def postgres_container() -> Generator[None, None, None]:
    """Start (and tear down) an ephemeral PostgreSQL container for this test session."""
    if not _docker_available():
        pytest.skip("Docker is not available; skipping repository integration tests")

    subprocess.run(["docker", "rm", "-f", _CONTAINER_NAME], capture_output=True, check=False)
    result = subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--rm",
            "--name",
            _CONTAINER_NAME,
            "-e",
            f"POSTGRES_PASSWORD={_TEST_PASSWORD}",
            "-p",
            f"{_HOST_PORT}:5432",
            "postgres:16-alpine",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        pytest.skip(f"Could not start the test PostgreSQL container: {result.stderr}")

    try:
        if not _wait_until_ready():
            pytest.skip("Test PostgreSQL container did not become ready in time")
        yield
    finally:
        subprocess.run(["docker", "rm", "-f", _CONTAINER_NAME], capture_output=True, check=False)


@pytest.fixture
async def book_db_session(postgres_container: None) -> AsyncGenerator[AsyncSession, None]:
    """A fresh `AsyncSession` against clean `users`/`books` tables for a single test.

    Seeds a single user row (id=`DEFAULT_SELLER_ID`) so books can be
    inserted without violating the `books.seller_id` foreign key.
    """
    engine = create_async_engine(_DATABASE_URL)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        session.add(
            UserORM(
                id=DEFAULT_SELLER_ID,
                email="seller@example.com",
                name="Default Test Seller",
                role="seller",
                hashed_password="not-a-real-hash",  # noqa: S106
            )
        )
        await session.commit()
        yield session

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def favourite_db_session(postgres_container: None) -> AsyncGenerator[AsyncSession, None]:
    """A fresh `AsyncSession` against clean tables for a single favourite-list test.

    Seeds a customer (id=`DEFAULT_OWNER_ID`) so favourite lists satisfy the
    `favourite_lists.owner_id` foreign key, and a book (id=`DEFAULT_BOOK_ID`,
    owned by that user) so list items satisfy `favourite_list_items.book_id`.
    """
    engine = create_async_engine(_DATABASE_URL)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        session.add(
            UserORM(
                id=DEFAULT_OWNER_ID,
                email="customer@example.com",
                name="Default Test Customer",
                role="customer",
                hashed_password="not-a-real-hash",  # noqa: S106
            )
        )
        await session.commit()
        session.add(
            BookORM(
                id=DEFAULT_BOOK_ID,
                title="Clean Architecture",
                author="Robert C. Martin",
                isbn="978-0134494166",
                price=39.99,
                stock=5,
                seller_id=DEFAULT_OWNER_ID,
                description="A craftsman's guide to software structure.",
                category="Software Engineering",
            )
        )
        await session.commit()
        yield session

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def two_book_sessions(
    postgres_container: None,
) -> AsyncGenerator[tuple[AsyncSession, AsyncSession], None]:
    """Two independent `AsyncSession`s on the same engine, sharing one seeded book.

    Used to exercise `BookORM`'s optimistic locking (`version_id_col`): both
    sessions load the same row (id=`DEFAULT_BOOK_ID`), so a `save()` from one
    after the other has already committed must raise `StaleDataError`.
    """
    engine = create_async_engine(_DATABASE_URL)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as seed_session:
        seed_session.add(
            UserORM(
                id=DEFAULT_SELLER_ID,
                email="seller@example.com",
                name="Default Test Seller",
                role="seller",
                hashed_password="not-a-real-hash",  # noqa: S106
            )
        )
        await seed_session.commit()
        seed_session.add(
            BookORM(
                id=DEFAULT_BOOK_ID,
                title="Clean Architecture",
                author="Robert C. Martin",
                isbn="978-0134494166",
                price=39.99,
                stock=5,
                seller_id=DEFAULT_SELLER_ID,
                description="A craftsman's guide to software structure.",
                category="Software Engineering",
            )
        )
        await seed_session.commit()

    session_one = session_factory()
    session_two = session_factory()
    try:
        yield session_one, session_two
    finally:
        await session_one.close()
        await session_two.close()
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.fixture
async def two_favourite_sessions(
    postgres_container: None,
) -> AsyncGenerator[tuple[AsyncSession, AsyncSession], None]:
    """Two independent `AsyncSession`s on the same engine, sharing seeded parent rows.

    Seeds a customer (id=`DEFAULT_OWNER_ID`) plus two catalog books
    (`DEFAULT_BOOK_ID` and `SECOND_BOOK_ID`) so each session can create/add a
    *different* book to the same favourite list, exercising
    `FavouriteListORM`'s optimistic locking (`version_id_col`) even though
    item-only changes don't otherwise touch the parent row (see
    `SqlAlchemyFavouriteListRepository.save`'s `flag_modified` call).
    """
    engine = create_async_engine(_DATABASE_URL)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as seed_session:
        seed_session.add(
            UserORM(
                id=DEFAULT_OWNER_ID,
                email="customer@example.com",
                name="Default Test Customer",
                role="customer",
                hashed_password="not-a-real-hash",  # noqa: S106
            )
        )
        await seed_session.commit()
        seed_session.add_all(
            [
                BookORM(
                    id=DEFAULT_BOOK_ID,
                    title="Clean Architecture",
                    author="Robert C. Martin",
                    isbn="978-0134494166",
                    price=39.99,
                    stock=5,
                    seller_id=DEFAULT_OWNER_ID,
                    description="A craftsman's guide to software structure.",
                    category="Software Engineering",
                ),
                BookORM(
                    id=SECOND_BOOK_ID,
                    title="Refactoring",
                    author="Martin Fowler",
                    isbn="978-0134757599",
                    price=47.99,
                    stock=3,
                    seller_id=DEFAULT_OWNER_ID,
                    description="Improving the design of existing code.",
                    category="Software Engineering",
                ),
            ]
        )
        await seed_session.commit()

    session_one = session_factory()
    session_two = session_factory()
    try:
        yield session_one, session_two
    finally:
        await session_one.close()
        await session_two.close()
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()
