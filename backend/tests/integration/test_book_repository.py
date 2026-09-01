"""Integration tests for `SqlAlchemyBookRepository` against a real PostgreSQL DB."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.book_repository import SqlAlchemyBookRepository

from tests.factories import make_book


async def test_save_when_new_book_persists_and_assigns_id(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    book = make_book()

    # Act
    saved = await sut.save(book)

    # Assert
    assert saved.id is not None
    assert saved.title == "Clean Architecture"
    assert saved.price == 39.99


async def test_find_by_id_when_book_exists_returns_book(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    saved = await sut.save(make_book())
    assert saved.id is not None

    # Act
    found = await sut.find_by_id(saved.id)

    # Assert
    assert found is not None
    assert found.id == saved.id
    assert found.isbn == saved.isbn


async def test_find_by_id_when_missing_returns_none(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)

    # Act
    found = await sut.find_by_id(999)

    # Assert
    assert found is None


async def test_find_all_paginates_results(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    for index in range(5):
        await sut.save(make_book(isbn=f"isbn-{index}"))

    # Act
    page = await sut.find_all(skip=2, limit=2)

    # Assert
    assert len(page) == 2


async def test_count_returns_total_number_of_books(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    for index in range(3):
        await sut.save(make_book(isbn=f"isbn-{index}"))

    # Act
    total = await sut.count()

    # Assert
    assert total == 3


async def test_search_matches_title_author_or_category_case_insensitively(
    book_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    await sut.save(make_book(isbn="isbn-1", author="Eric Evans", title="Clean Code"))
    await sut.save(make_book(isbn="isbn-2", author="Martin Fowler", title="Refactoring"))
    await sut.save(
        make_book(isbn="isbn-3", author="Eric Evans", title="Domain-Driven Design", category="DDD")
    )

    # Act
    results = await sut.search(query="clean", skip=0, limit=10)

    # Assert
    assert len(results) == 1
    assert results[0].title == "Clean Code"


async def test_count_search_returns_total_matches(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    await sut.save(make_book(isbn="isbn-1", author="Eric Evans", title="Refactoring"))
    await sut.save(make_book(isbn="isbn-2", author="Eric Evans", title="Clean Code"))
    await sut.save(make_book(isbn="isbn-3", author="Martin Fowler", title="Domain-Driven Design"))

    # Act
    total = await sut.count_search(query="eric")

    # Assert
    assert total == 2


async def test_save_when_existing_book_updates_fields(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    saved = await sut.save(make_book())
    assert saved.id is not None

    # Act
    changed = make_book(id=saved.id, title="Clean Architecture (2nd ed.)", stock=10)
    updated = await sut.save(changed)

    # Assert
    assert updated.id == saved.id
    assert updated.title == "Clean Architecture (2nd ed.)"
    assert updated.stock == 10


async def test_save_when_id_does_not_exist_raises_value_error(
    book_db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    orphaned_update = make_book(id=999)

    # Act / Assert
    with pytest.raises(ValueError, match="999"):
        await sut.save(orphaned_update)


async def test_delete_removes_book(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)
    saved = await sut.save(make_book())
    assert saved.id is not None

    # Act
    await sut.delete(saved.id)

    # Assert
    assert await sut.find_by_id(saved.id) is None


async def test_delete_when_book_missing_does_not_raise(book_db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyBookRepository(book_db_session)

    # Act / Assert — deleting a non-existent book is a no-op, not an error.
    await sut.delete(999)
