"""Global pytest fixtures: DB session and async HTTP client.

Integration and API tests run against the real Postgres instance
configured via `.env` (see `src/config/settings.py`). Each test gets
its own connection wrapped in a transaction that is rolled back at
teardown, so tests never leave data behind and can run repeatedly
without colliding on unique constraints (e.g. `users.email`).

The `users` table must already exist — run `alembic upgrade head`
before running the integration/API test suite.
"""

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from src.adapters.outbound.persistence.database import get_db_session
from src.config.settings import settings
from src.main import app


@pytest_asyncio.fixture
async def db_connection() -> AsyncGenerator[AsyncConnection, None]:
    """A DB connection with an open transaction, rolled back after the test."""
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as connection:
        await connection.begin()
        yield connection
        await connection.rollback()
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_connection: AsyncConnection) -> AsyncGenerator[AsyncSession, None]:
    """An `AsyncSession` bound to `db_connection`, isolated via a SAVEPOINT.

    Using `join_transaction_mode="create_savepoint"` means the session's own
    `commit()` calls (made by repositories) only release a savepoint instead
    of ending the outer transaction, which is rolled back by `db_connection`.
    """
    session_factory = async_sessionmaker(
        bind=db_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """An `httpx.AsyncClient` wired to the FastAPI app with an isolated DB session."""

    async def _override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override_get_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
