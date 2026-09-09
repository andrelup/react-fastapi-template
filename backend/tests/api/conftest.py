"""Fixtures for API tests: httpx.AsyncClient wired to the FastAPI app.

These tests exercise router wiring, request/response validation and
error-to-HTTP translation without needing a real database. `get_current_user`
is left un-overridden by default, so tests that don't call `authenticated_as`
exercise the real provisional JWT dependency (e.g. to verify 401 on missing
credentials).
"""

from collections.abc import AsyncGenerator, Callable

import httpx
import pytest
from src.adapters.inbound.middleware.auth import get_current_user
from src.domain.models.user import User
from src.main import app


@pytest.fixture
def authenticated_as() -> Callable[[User], None]:
    """Return a function that overrides `get_current_user` for the app under test."""

    def _authenticate(user: User) -> None:
        app.dependency_overrides[get_current_user] = lambda: user

    return _authenticate


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """An `httpx.AsyncClient` wired to the app, without a running server."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()
