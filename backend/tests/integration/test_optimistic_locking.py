"""Integration tests for SQLAlchemy-native optimistic locking (`version_id_col`).

Both `BookORM` and `FavouriteListORM` carry a `version` column wired as the
mapper's `version_id_col`. These tests prove that two independent sessions
that load the same row and both try to save a change end up with the
*second* commit raising `StaleDataError`, rather than silently overwriting
the first — the concrete scenario this feature protects against.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError
from src.adapters.outbound.persistence.book_repository import SqlAlchemyBookRepository
from src.adapters.outbound.persistence.favourite_list_repository import (
    SqlAlchemyFavouriteListRepository,
)

from tests.factories import make_favourite_list
from tests.integration.conftest import DEFAULT_BOOK_ID, DEFAULT_OWNER_ID, SECOND_BOOK_ID


async def test_save_when_two_sessions_update_same_book_second_raises_stale_data_error(
    two_book_sessions: tuple[AsyncSession, AsyncSession],
) -> None:
    # Arrange
    session_one, session_two = two_book_sessions
    repository_one = SqlAlchemyBookRepository(session_one)
    repository_two = SqlAlchemyBookRepository(session_two)
    book_one = await repository_one.find_by_id(DEFAULT_BOOK_ID)
    book_two = await repository_two.find_by_id(DEFAULT_BOOK_ID)
    assert book_one is not None
    assert book_two is not None

    # Act
    book_one.stock = 10
    await repository_one.save(book_one)

    book_two.stock = 20
    with pytest.raises(StaleDataError):
        await repository_two.save(book_two)
    await session_two.rollback()

    # Assert
    final_book = await repository_one.find_by_id(DEFAULT_BOOK_ID)
    assert final_book is not None
    assert final_book.stock == 10


async def test_save_when_two_sessions_add_different_books_second_raises_stale_data_error(
    two_favourite_sessions: tuple[AsyncSession, AsyncSession],
) -> None:
    # Arrange
    session_one, session_two = two_favourite_sessions
    repository_one = SqlAlchemyFavouriteListRepository(session_one)
    created = await repository_one.save(make_favourite_list(owner_id=DEFAULT_OWNER_ID))
    assert created.id is not None

    repository_two = SqlAlchemyFavouriteListRepository(session_two)
    list_one = await repository_one.find_by_id(created.id)
    list_two = await repository_two.find_by_id(created.id)
    assert list_one is not None
    assert list_two is not None

    # Act
    list_one.book_ids = [DEFAULT_BOOK_ID]
    await repository_one.save(list_one)

    list_two.book_ids = [SECOND_BOOK_ID]
    with pytest.raises(StaleDataError):
        await repository_two.save(list_two)
    await session_two.rollback()

    # Assert
    final_list = await repository_one.find_by_id(created.id)
    assert final_list is not None
    assert final_list.book_ids == [DEFAULT_BOOK_ID]
