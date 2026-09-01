"""Integration tests for `SqlAlchemyFavouriteListRepository` against a real DB."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.favourite_list_repository import (
    SqlAlchemyFavouriteListRepository,
)

from tests.factories import make_favourite_list
from tests.integration.conftest import DEFAULT_BOOK_ID, DEFAULT_OWNER_ID


async def test_save_when_new_list_persists_and_assigns_id(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    favourite_list = make_favourite_list(owner_id=DEFAULT_OWNER_ID)

    # Act
    saved = await sut.save(favourite_list)

    # Assert
    assert saved.id is not None
    assert saved.name == "Summer 2026"
    assert saved.book_ids == []


async def test_save_persists_items_as_book_ids(favourite_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    favourite_list = make_favourite_list(owner_id=DEFAULT_OWNER_ID, book_ids=[DEFAULT_BOOK_ID])

    # Act
    saved = await sut.save(favourite_list)

    # Assert
    assert saved.book_ids == [DEFAULT_BOOK_ID]


async def test_find_by_id_when_exists_returns_list_with_books(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    saved = await sut.save(
        make_favourite_list(owner_id=DEFAULT_OWNER_ID, book_ids=[DEFAULT_BOOK_ID])
    )
    assert saved.id is not None

    # Act
    found = await sut.find_by_id(saved.id)

    # Assert
    assert found is not None
    assert found.id == saved.id
    assert found.book_ids == [DEFAULT_BOOK_ID]


async def test_find_by_id_when_missing_returns_none(favourite_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)

    # Act
    found = await sut.find_by_id(999)

    # Assert
    assert found is None


async def test_find_all_by_owner_returns_only_that_owners_lists(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    await sut.save(make_favourite_list(owner_id=DEFAULT_OWNER_ID, name="Mine A"))
    await sut.save(make_favourite_list(owner_id=DEFAULT_OWNER_ID, name="Mine B"))

    # Act
    lists = await sut.find_all_by_owner(DEFAULT_OWNER_ID)

    # Assert
    assert {favourite_list.name for favourite_list in lists} == {"Mine A", "Mine B"}


async def test_find_by_owner_and_name_returns_match(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    await sut.save(make_favourite_list(owner_id=DEFAULT_OWNER_ID, name="Gifts"))

    # Act
    found = await sut.find_by_owner_and_name(DEFAULT_OWNER_ID, "Gifts")

    # Assert
    assert found is not None
    assert found.name == "Gifts"


async def test_find_by_owner_and_name_when_absent_returns_none(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)

    # Act
    found = await sut.find_by_owner_and_name(DEFAULT_OWNER_ID, "Nope")

    # Assert
    assert found is None


async def test_save_when_existing_list_updates_name_and_items(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    saved = await sut.save(make_favourite_list(owner_id=DEFAULT_OWNER_ID))
    assert saved.id is not None

    # Act
    saved.name = "Beach reads"
    saved.book_ids = [DEFAULT_BOOK_ID]
    updated = await sut.save(saved)

    # Assert
    assert updated.id == saved.id
    assert updated.name == "Beach reads"
    assert updated.book_ids == [DEFAULT_BOOK_ID]


async def test_save_when_removing_an_item_reconciles_children(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    saved = await sut.save(
        make_favourite_list(owner_id=DEFAULT_OWNER_ID, book_ids=[DEFAULT_BOOK_ID])
    )
    assert saved.id is not None

    # Act
    saved.book_ids = []
    updated = await sut.save(saved)

    # Assert
    assert updated.book_ids == []


async def test_save_when_id_does_not_exist_raises_value_error(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    orphaned_update = make_favourite_list(id=999, owner_id=DEFAULT_OWNER_ID)

    # Act / Assert
    with pytest.raises(ValueError, match="999"):
        await sut.save(orphaned_update)


async def test_delete_removes_list_and_cascades_items(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)
    saved = await sut.save(
        make_favourite_list(owner_id=DEFAULT_OWNER_ID, book_ids=[DEFAULT_BOOK_ID])
    )
    assert saved.id is not None

    # Act
    await sut.delete(saved.id)

    # Assert
    assert await sut.find_by_id(saved.id) is None


async def test_delete_when_list_missing_does_not_raise(
    favourite_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyFavouriteListRepository(favourite_db_session)

    # Act / Assert — deleting a non-existent list is a no-op, not an error.
    await sut.delete(999)
