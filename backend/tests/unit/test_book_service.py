"""Unit tests for `BookService`, using the in-memory fake repository (no DB).

The fake repository asserts the book's `version` on every update, exactly like
`version_id_col` does against Postgres, so the tests below can prove the
*client's* version (not the freshly-loaded one) is what reaches the write.
"""

import pytest
from sqlalchemy.orm.exc import StaleDataError
from src.domain.exceptions import BookNotFoundError, BookValidationError, ForbiddenError
from src.domain.models.user import User
from src.domain.services.book_service import BookService

from tests.factories import make_book
from tests.fakes.fake_book_repository import FakeBookRepository


@pytest.fixture
def sut() -> BookService:
    return BookService(FakeBookRepository())


async def test_create_when_seller_creates_book_returns_saved_book_owned_by_seller(
    sut: BookService, seller_user: User
) -> None:
    # Arrange
    book = make_book(seller_id=999)  # attacker-controlled seller_id must be ignored

    # Act
    created = await sut.create(seller_user, book)

    # Assert
    assert created.id is not None
    assert created.seller_id == seller_user.id
    assert created.title == "Clean Architecture"


async def test_create_when_customer_attempts_raises_forbidden(
    sut: BookService, customer_user: User
) -> None:
    # Arrange
    book = make_book()

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.create(customer_user, book)


@pytest.mark.parametrize(
    "overrides",
    [
        {"price": 0},
        {"price": -10},
        {"stock": -1},
        {"title": "   "},
        {"isbn": ""},
    ],
)
async def test_create_when_book_data_invalid_raises_validation_error(
    sut: BookService, seller_user: User, overrides: dict[str, object]
) -> None:
    # Arrange
    book = make_book(**overrides)

    # Act / Assert
    with pytest.raises(BookValidationError):
        await sut.create(seller_user, book)


async def test_update_when_owner_seller_updates_returns_updated_book(
    sut: BookService, seller_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    changes = make_book(title="Clean Architecture (2nd ed.)")
    assert created.id is not None

    # Act
    updated = await sut.update(seller_user, created.id, changes)

    # Assert
    assert updated.id == created.id
    assert updated.title == "Clean Architecture (2nd ed.)"
    assert updated.seller_id == seller_user.id


async def test_update_when_different_seller_raises_forbidden(
    sut: BookService, seller_user: User, other_seller_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.update(other_seller_user, created.id, make_book())


async def test_update_when_customer_attempts_raises_forbidden(
    sut: BookService, seller_user: User, customer_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.update(customer_user, created.id, make_book())


async def test_update_when_book_missing_raises_not_found(
    sut: BookService, seller_user: User
) -> None:
    # Act / Assert
    with pytest.raises(BookNotFoundError):
        await sut.update(seller_user, 999, make_book())


async def test_update_cannot_transfer_book_to_another_seller(
    sut: BookService, seller_user: User
) -> None:
    # Arrange — even if the payload carries a different seller_id, ownership
    # must not change via update.
    created = await sut.create(seller_user, make_book())
    assert created.id is not None
    changes = make_book(seller_id=999)

    # Act
    updated = await sut.update(seller_user, created.id, changes)

    # Assert
    assert updated.seller_id == seller_user.id


async def test_delete_when_owner_seller_deletes_book_is_removed(
    sut: BookService, seller_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None

    # Act
    await sut.delete(seller_user, created.id)

    # Assert
    with pytest.raises(BookNotFoundError):
        await sut.get(created.id)


async def test_delete_when_different_seller_raises_forbidden(
    sut: BookService, seller_user: User, other_seller_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.delete(other_seller_user, created.id)


async def test_delete_when_customer_attempts_raises_forbidden(
    sut: BookService, seller_user: User, customer_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None

    # Act / Assert
    with pytest.raises(ForbiddenError):
        await sut.delete(customer_user, created.id)


async def test_delete_when_book_missing_raises_not_found(
    sut: BookService, seller_user: User
) -> None:
    # Act / Assert
    with pytest.raises(BookNotFoundError):
        await sut.delete(seller_user, 999)


async def test_get_when_book_exists_returns_book(sut: BookService, seller_user: User) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None

    # Act
    book = await sut.get(created.id)

    # Assert
    assert book == created


async def test_get_when_missing_raises_not_found(sut: BookService) -> None:
    # Act / Assert
    with pytest.raises(BookNotFoundError):
        await sut.get(999)


async def test_list_books_returns_page_and_total(sut: BookService, seller_user: User) -> None:
    # Arrange
    for index in range(5):
        await sut.create(seller_user, make_book(isbn=f"isbn-{index}"))

    # Act
    books, total = await sut.list_books(skip=1, limit=2)

    # Assert
    assert total == 5
    assert len(books) == 2


async def test_search_returns_matching_books_and_total(sut: BookService, seller_user: User) -> None:
    # Arrange
    await sut.create(seller_user, make_book(isbn="isbn-1", title="Domain-Driven Design"))
    await sut.create(seller_user, make_book(isbn="isbn-2", title="Clean Code"))
    await sut.create(seller_user, make_book(isbn="isbn-3", title="Refactoring"))

    # Act
    books, total = await sut.search(query="clean", skip=0, limit=10)

    # Assert
    assert total == 1
    assert books[0].title == "Clean Code"


async def test_update_sends_the_clients_version_and_bumps_it(
    sut: BookService, seller_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None
    changes = make_book(stock=10, version=created.version)

    # Act — the client updates from the version it read.
    updated = await sut.update(seller_user, created.id, changes)

    # Assert — the write went through and moved the version forward.
    assert updated.stock == 10
    assert updated.version == created.version + 1


async def test_update_when_version_is_stale_raises_stale_data_error(
    sut: BookService, seller_user: User
) -> None:
    # Arrange — a concurrent update already moved the book past `created.version`.
    created = await sut.create(seller_user, make_book())
    assert created.id is not None
    await sut.update(seller_user, created.id, make_book(stock=10, version=created.version))

    # Act / Assert — the stale version travels into the write and is rejected
    # there (a service-level comparison would be a TOCTOU race).
    with pytest.raises(StaleDataError):
        await sut.update(seller_user, created.id, make_book(stock=99, version=created.version))


async def test_update_when_version_is_stale_does_not_overwrite_the_change(
    sut: BookService, seller_user: User
) -> None:
    # Arrange
    created = await sut.create(seller_user, make_book())
    assert created.id is not None
    await sut.update(seller_user, created.id, make_book(stock=10, version=created.version))

    # Act
    with pytest.raises(StaleDataError):
        await sut.update(seller_user, created.id, make_book(stock=99, version=created.version))

    # Assert — the concurrent update survived: no lost update.
    current = await sut.get(created.id)
    assert current.stock == 10


async def test_update_does_not_replace_the_clients_version_with_the_stored_one(
    sut: BookService, seller_user: User
) -> None:
    # Arrange — the book is at version 2 after one update; the client that
    # read it at version 2 must be able to write, the one still at version 1
    # must not. If the service overwrote the incoming version with the stored
    # one, both would succeed and the lock would not exist.
    created = await sut.create(seller_user, make_book())
    assert created.id is not None
    fresh = await sut.update(seller_user, created.id, make_book(version=created.version))

    # Act
    updated = await sut.update(seller_user, created.id, make_book(stock=7, version=fresh.version))

    # Assert
    assert updated.stock == 7
    with pytest.raises(StaleDataError):
        await sut.update(seller_user, created.id, make_book(version=created.version))
