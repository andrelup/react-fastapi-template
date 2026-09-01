"""API tests for the favourite lists router: httpx.AsyncClient against the app.

Covers status codes, the `{"success", "data", "error"}` envelope,
authorization (401 unauthenticated, 403 for sellers, 404 for cross-customer
access, 409 error translation) and the optimistic-locking `version`
round-trip on rename (200 on a current version, 409 on a stale one). Adding
and removing books deliberately need no version: they carry a `book_id`, not
client-loaded state.
"""

from collections.abc import Callable
from typing import Any

import httpx
from src.domain.models.user import User
from src.domain.services.book_service import BookService
from src.domain.services.favourite_list_service import FavouriteListService

from tests.factories import make_book


async def _create_list(client: httpx.AsyncClient, name: str = "Summer 2026") -> dict[str, Any]:
    response = await client.post("/favourite-lists", json={"name": name})
    assert response.status_code == 201
    data: dict[str, Any] = response.json()["data"]
    return data


async def test_create_list_when_customer_returns_201(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    response = await client.post("/favourite-lists", json={"name": "Summer 2026"})

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    assert body["data"]["name"] == "Summer 2026"
    assert body["data"]["owner_id"] == customer_user.id
    assert body["data"]["book_ids"] == []


async def test_create_list_when_seller_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
) -> None:
    # Arrange
    authenticated_as(seller_user)

    # Act
    response = await client.post("/favourite-lists", json={"name": "Summer 2026"})

    # Assert
    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"] is not None


async def test_create_list_when_no_credentials_returns_401(client: httpx.AsyncClient) -> None:
    # Act — `authenticated_as` was never called, so the real provisional
    # `get_current_user` dependency runs against a request with no token.
    response = await client.post("/favourite-lists", json={"name": "Summer 2026"})

    # Assert
    assert response.status_code == 401


async def test_create_list_when_name_blank_returns_422(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    response = await client.post("/favourite-lists", json={"name": ""})

    # Assert
    assert response.status_code == 422


async def test_create_list_when_name_duplicated_returns_409(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    await _create_list(client)

    # Act
    response = await client.post("/favourite-lists", json={"name": "Summer 2026"})

    # Assert
    assert response.status_code == 409


async def test_list_lists_returns_only_own_lists(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    other_customer_user: User,
) -> None:
    # Arrange
    authenticated_as(other_customer_user)
    await _create_list(client, name="Theirs")
    authenticated_as(customer_user)
    await _create_list(client, name="Mine")

    # Act
    response = await client.get("/favourite-lists")

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["total"] == 1
    assert body["data"]["items"][0]["name"] == "Mine"


async def test_get_list_when_owner_returns_200(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.get(f"/favourite-lists/{created['id']}")

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["id"] == created["id"]


async def test_get_list_when_missing_returns_404(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    response = await client.get("/favourite-lists/999")

    # Assert
    assert response.status_code == 404
    assert response.json()["success"] is False


async def test_get_list_when_another_customers_returns_404(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    other_customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)
    authenticated_as(other_customer_user)

    # Act
    response = await client.get(f"/favourite-lists/{created['id']}")

    # Assert
    assert response.status_code == 404


async def test_rename_list_when_owner_returns_200(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.put(
        f"/favourite-lists/{created['id']}",
        json={"name": "Beach reads", "version": created["version"]},
    )

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Beach reads"


async def test_create_list_returns_initial_version(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)

    # Act
    created = await _create_list(client)

    # Assert — a brand new list is born at version 1, ready to be sent back.
    assert created["version"] == 1


async def test_rename_list_when_version_current_returns_200_and_increments_version(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.put(
        f"/favourite-lists/{created['id']}",
        json={"name": "Beach reads", "version": created["version"]},
    )

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["version"] == created["version"] + 1


async def test_rename_list_twice_with_returned_version_both_return_200(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act — each rename sends the version returned by the previous one.
    first = await client.put(
        f"/favourite-lists/{created['id']}",
        json={"name": "Beach reads", "version": created["version"]},
    )
    first_version = first.json()["data"]["version"]
    second = await client.put(
        f"/favourite-lists/{created['id']}",
        json={"name": "Winter reads", "version": first_version},
    )

    # Assert
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["data"]["name"] == "Winter reads"
    assert second.json()["data"]["version"] == first_version + 1


async def test_rename_list_when_version_stale_returns_409_and_keeps_previous_name(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange — someone else already renamed the list, so the version this
    # client read is no longer the current one.
    authenticated_as(customer_user)
    created = await _create_list(client)
    await client.put(
        f"/favourite-lists/{created['id']}",
        json={"name": "Beach reads", "version": created["version"]},
    )

    # Act — a rename based on the now-stale version.
    response = await client.put(
        f"/favourite-lists/{created['id']}",
        json={"name": "Hijacked", "version": created["version"]},
    )

    # Assert — rejected, and the concurrent rename was not overwritten.
    assert response.status_code == 409
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    current = await client.get(f"/favourite-lists/{created['id']}")
    assert current.json()["data"]["name"] == "Beach reads"


async def test_rename_list_when_version_missing_returns_422(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange — `version` is mandatory: without it the server could not tell
    # which state the rename is based on, and the lock would not exist.
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.put(f"/favourite-lists/{created['id']}", json={"name": "Beach reads"})

    # Assert
    assert response.status_code == 422


async def test_delete_list_when_owner_returns_200_and_removes_it(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.delete(f"/favourite-lists/{created['id']}")

    # Assert
    assert response.status_code == 200
    assert response.json()["success"] is True
    follow_up = await client.get(f"/favourite-lists/{created['id']}")
    assert follow_up.status_code == 404


async def test_add_book_when_owner_returns_201_with_book(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    book = await book_service.create(seller_user, make_book())
    assert book.id is not None
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.post(
        f"/favourite-lists/{created['id']}/books", json={"book_id": book.id}
    )

    # Assert
    assert response.status_code == 201
    assert response.json()["data"]["book_ids"] == [book.id]


async def test_add_book_when_book_missing_returns_404(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
) -> None:
    # Arrange
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act
    response = await client.post(f"/favourite-lists/{created['id']}/books", json={"book_id": 999})

    # Assert
    assert response.status_code == 404


async def test_add_book_when_duplicate_returns_409(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    book = await book_service.create(seller_user, make_book())
    assert book.id is not None
    authenticated_as(customer_user)
    created = await _create_list(client)
    await client.post(f"/favourite-lists/{created['id']}/books", json={"book_id": book.id})

    # Act
    response = await client.post(
        f"/favourite-lists/{created['id']}/books", json={"book_id": book.id}
    )

    # Assert
    assert response.status_code == 409


async def test_remove_book_when_owner_returns_200_and_removes_it(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange
    book = await book_service.create(seller_user, make_book())
    assert book.id is not None
    authenticated_as(customer_user)
    created = await _create_list(client)
    await client.post(f"/favourite-lists/{created['id']}/books", json={"book_id": book.id})

    # Act
    response = await client.delete(f"/favourite-lists/{created['id']}/books/{book.id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["book_ids"] == []


async def test_add_book_when_seller_returns_403(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    seller_user: User,
    favourite_list_service: FavouriteListService,
    customer_user: User,
) -> None:
    # Arrange — a customer owns the list, then a seller attempts to touch it.
    created = await favourite_list_service.create(customer_user, "Summer 2026")
    assert created.id is not None
    authenticated_as(seller_user)

    # Act
    response = await client.post(f"/favourite-lists/{created.id}/books", json={"book_id": 1})

    # Assert
    assert response.status_code == 403


async def test_add_and_remove_books_need_no_version_and_keep_working(
    client: httpx.AsyncClient,
    authenticated_as: Callable[[User], None],
    customer_user: User,
    seller_user: User,
    book_service: BookService,
) -> None:
    # Arrange — adding/removing a book carries a `book_id`, not client-loaded
    # state, so it must never require a version: the frontend cannot be forced
    # to reload the whole list before every "add to favourites" click. Each
    # mutation still bumps the list's version, so this also proves later
    # add/remove calls don't start failing once the version has moved past 1.
    first_book = await book_service.create(seller_user, make_book(isbn="isbn-1"))
    second_book = await book_service.create(seller_user, make_book(isbn="isbn-2"))
    assert first_book.id is not None
    assert second_book.id is not None
    authenticated_as(customer_user)
    created = await _create_list(client)

    # Act — three consecutive mutations, none of them sending a version.
    add_first = await client.post(
        f"/favourite-lists/{created['id']}/books", json={"book_id": first_book.id}
    )
    add_second = await client.post(
        f"/favourite-lists/{created['id']}/books", json={"book_id": second_book.id}
    )
    removed = await client.delete(f"/favourite-lists/{created['id']}/books/{first_book.id}")

    # Assert
    assert add_first.status_code == 201
    assert add_second.status_code == 201
    assert removed.status_code == 200
    assert removed.json()["data"]["book_ids"] == [second_book.id]
