"""API tests for the books router: httpx.AsyncClient against the FastAPI app.

Covers status codes, the `{"success", "data", "error"}` envelope,
role-based authorization (401/403/404/422 translation) and the
optimistic-locking `version` round-trip (200 on a current version, 409 on a
stale one).
"""

from collections.abc import Callable
from typing import Any

import httpx
from src.domain.models.user import User
from src.domain.services.book_service import BookService

from tests.factories import make_book

_VALID_PAYLOAD = {
    "title": "Clean Architecture",
    "author": "Robert C. Martin",
    "isbn": "978-0134494166",
    "price": 39.99,
    "stock": 5,
    "description": "A craftsman's guide to software structure.",
    "category": "Software Engineering",
}


def _update_payload(version: int, **overrides: Any) -> dict[str, Any]:
    """Build a `BookUpdate` body: the create fields plus the mandatory `version`.

    `version` is the version the client read the book at; the server asserts it
    against the stored row, so it has to be sent on every update.
    """
    return {**_VALID_PAYLOAD, "version": version, **overrides}


async def test_create_book_when_seller_returns_201_and_book(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
) -> None:
    # Arrange
    authenticated_as(seller_user)

    # Act
    response = await client.post("/books", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    assert body["data"]["title"] == "Clean Architecture"
    assert body["data"]["seller_id"] == seller_user.id
    assert body["data"]["version"] == 1


async def test_create_book_when_customer_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    response = await client.post("/books", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"] is not None


async def test_create_book_when_no_credentials_returns_401(client: httpx.AsyncClient) -> None:
    # Act — `authenticated_as` was never called, so the real provisional
    # `get_current_user` dependency runs against a request with no token.
    response = await client.post("/books", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 401


async def test_create_book_when_price_not_positive_returns_422(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
) -> None:
    # Arrange
    authenticated_as(seller_user)
    payload = {**_VALID_PAYLOAD, "price": 0}

    # Act
    response = await client.post("/books", json=payload)

    # Assert
    assert response.status_code == 422


async def test_list_books_returns_200_with_pagination(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    for index in range(3):
        await book_service.create(seller_user, make_book(isbn=f"isbn-{index}"))
    authenticated_as(customer_user)

    # Act
    response = await client.get("/books", params={"skip": 0, "limit": 2})

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["total"] == 3
    assert len(body["data"]["items"]) == 2


async def test_get_book_when_exists_returns_200(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(customer_user)

    # Act
    response = await client.get(f"/books/{created.id}")

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["id"] == created.id


async def test_get_book_returns_current_version(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange — a book created (version 1) and then updated once (version 2).
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)
    await client.put(f"/books/{created.id}", json=_update_payload(created.version))

    # Act
    response = await client.get(f"/books/{created.id}")

    # Assert — the client can read the version it must send back on the next update.
    assert response.status_code == 200
    assert response.json()["data"]["version"] == created.version + 1


async def test_get_book_when_missing_returns_404(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    response = await client.get("/books/999")

    # Assert
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False


async def test_search_books_returns_200_with_matches(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    await book_service.create(seller_user, make_book(isbn="isbn-1", title="Clean Code"))
    await book_service.create(seller_user, make_book(isbn="isbn-2", title="Refactoring"))
    authenticated_as(customer_user)

    # Act
    response = await client.get("/books/search", params={"q": "clean"})

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["title"] == "Clean Code"


async def test_update_book_when_owner_seller_returns_200(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)
    payload = _update_payload(created.version, title="Clean Architecture (2nd ed.)")

    # Act
    response = await client.put(f"/books/{created.id}", json=payload)

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["title"] == "Clean Architecture (2nd ed.)"


async def test_update_book_when_version_current_returns_200_and_increments_version(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)

    # Act
    response = await client.put(f"/books/{created.id}", json=_update_payload(created.version))

    # Assert — the response carries the new version, which the client must send next time.
    assert response.status_code == 200
    assert response.json()["data"]["version"] == created.version + 1


async def test_update_book_twice_with_returned_version_both_return_200(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange — regression test: before the version reached the API, every PUT
    # sent the dataclass default (1), so the second one hit a row already at
    # version 2 and failed with a spurious 409 with zero concurrency involved.
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)

    # Act — each PUT sends the version returned by the previous one.
    first = await client.put(f"/books/{created.id}", json=_update_payload(created.version))
    first_version = first.json()["data"]["version"]
    second = await client.put(f"/books/{created.id}", json=_update_payload(first_version, stock=42))

    # Assert
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["data"]["stock"] == 42
    assert second.json()["data"]["version"] == first_version + 1


async def test_update_book_when_version_stale_returns_409_and_keeps_previous_state(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange — someone else already updated the book, so the version this
    # client read is no longer the current one.
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)
    await client.put(f"/books/{created.id}", json=_update_payload(created.version, stock=10))

    # Act — a write based on the now-stale version.
    response = await client.put(
        f"/books/{created.id}", json=_update_payload(created.version, stock=99)
    )

    # Assert — rejected, and the concurrent change was not overwritten.
    assert response.status_code == 409
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    current = await client.get(f"/books/{created.id}")
    assert current.json()["data"]["stock"] == 10


async def test_update_book_when_version_missing_returns_422(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange — `version` is mandatory: without it the server could not tell
    # which state the update is based on, and the lock would not exist.
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)

    # Act
    response = await client.put(f"/books/{created.id}", json=_VALID_PAYLOAD)

    # Assert
    assert response.status_code == 422


async def test_update_book_when_different_seller_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    other_seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(other_seller_user)

    # Act
    response = await client.put(f"/books/{created.id}", json=_update_payload(created.version))

    # Assert
    assert response.status_code == 403


async def test_update_book_when_customer_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    customer_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(customer_user)

    # Act
    response = await client.put(f"/books/{created.id}", json=_update_payload(created.version))

    # Assert
    assert response.status_code == 403


async def test_delete_book_when_owner_seller_returns_200_and_book_removed(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(seller_user)

    # Act
    response = await client.delete(f"/books/{created.id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["success"] is True
    follow_up = await client.get(f"/books/{created.id}")
    assert follow_up.status_code == 404


async def test_delete_book_when_different_seller_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    other_seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(other_seller_user)

    # Act
    response = await client.delete(f"/books/{created.id}")

    # Assert
    assert response.status_code == 403


async def test_delete_book_when_customer_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    customer_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    created = await book_service.create(seller_user, make_book())
    assert created.id is not None
    authenticated_as(customer_user)

    # Act
    response = await client.delete(f"/books/{created.id}")

    # Assert
    assert response.status_code == 403
