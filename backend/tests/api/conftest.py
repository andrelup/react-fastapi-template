"""Fixtures for API tests: httpx.AsyncClient wired to the FastAPI app.

The outbound `BookRepository` port is faked out via FastAPI dependency
overrides, so these tests exercise router wiring, request/response
validation and error-to-HTTP translation without needing a real database.
`get_current_user` is left un-overridden by default, so tests that don't
call `authenticated_as` exercise the real provisional JWT dependency
(e.g. to verify 401 on missing credentials).
"""

from collections.abc import AsyncGenerator, Callable

import httpx
import pytest
from src.adapters.inbound.middleware.auth import get_current_user
from src.config.container import get_book_service, get_favourite_list_service
from src.domain.models.user import User
from src.domain.services.book_service import BookService
from src.domain.services.favourite_list_service import FavouriteListService
from src.main import app

from tests.fakes.fake_book_repository import FakeBookRepository
from tests.fakes.fake_favourite_list_repository import FakeFavouriteListRepository


@pytest.fixture
def fake_book_repository() -> FakeBookRepository:
    """An isolated in-memory book repository, shared by the two services per test.

    Sharing one instance lets an API test seed a book via `book_service` and then
    add it to a list through the favourite endpoints.
    """
    return FakeBookRepository()


@pytest.fixture
def book_service(fake_book_repository: FakeBookRepository) -> BookService:
    """A `BookService` backed by an isolated in-memory fake repository per test."""
    return BookService(fake_book_repository)


@pytest.fixture
def favourite_list_service(fake_book_repository: FakeBookRepository) -> FavouriteListService:
    """A `FavouriteListService` sharing the test's fake book repository."""
    return FavouriteListService(FakeFavouriteListRepository(), fake_book_repository)


@pytest.fixture
def authenticated_as() -> Callable[[User], None]:
    """Return a function that overrides `get_current_user` for the app under test."""

    def _authenticate(user: User) -> None:
        app.dependency_overrides[get_current_user] = lambda: user

    return _authenticate


@pytest.fixture
async def client(
    book_service: BookService,
    favourite_list_service: FavouriteListService,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """An `httpx.AsyncClient` wired to the app, with the domain services faked out."""
    app.dependency_overrides[get_book_service] = lambda: book_service
    app.dependency_overrides[get_favourite_list_service] = lambda: favourite_list_service
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()
