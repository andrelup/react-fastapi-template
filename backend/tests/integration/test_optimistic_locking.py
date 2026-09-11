"""The optimistic lock, proven against real PostgreSQL.

This is the one test that cannot exist at any other tier: it is what shows
`attributes.set_committed_value` in `SqlAlchemyItemRepository.save` actually
does something. Comment that line out and the test fails with "DID NOT RAISE",
because the UPDATE's `WHERE version = :v` would then compare against whatever
version the session already holds in memory instead of the one the client read.

A subtlety that makes the first test read strangely: both `find_by_id` calls go
through the *same* session, so `session.get()` returns the same identity-mapped
`ItemORM` rather than re-reading the row. What keeps `first` and `second`
independent is `_to_domain`, which builds a new `Item` dataclass from the
scalar values each time. In production the isolation is real — one session per
request — and here it is `set_committed_value` doing the work.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError
from src.adapters.outbound.persistence.example.item_repository import SqlAlchemyItemRepository
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole


async def _an_owner(db_session: AsyncSession) -> int:
    """Insert a user and return its id, for use as `items.owner_id`."""
    saved = await SqlAlchemyUserRepository(db_session).save(
        User(
            email="lock-owner@example.com",
            name="Owner",
            role=UserRole.EDITOR,
            hashed_password="hashed:pw",
        )
    )
    assert saved.id is not None
    return saved.id


async def test_save_with_a_stale_version_raises_stale_data_error(db_session: AsyncSession) -> None:
    # Arrange — two callers read the same item
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    stored = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))
    assert stored.id is not None
    first = await sut.find_by_id(stored.id)
    second = await sut.find_by_id(stored.id)

    # Act — the first write wins and bumps the version
    assert first is not None and second is not None
    first.name = "Manual v2"
    await sut.save(first)

    # Assert — the second write is working from a version that no longer exists
    second.name = "Manual v3"
    with pytest.raises(StaleDataError):
        await sut.save(second)


async def test_the_winning_write_is_the_one_that_survives(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    stored = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))
    assert stored.id is not None
    first = await sut.find_by_id(stored.id)
    second = await sut.find_by_id(stored.id)
    assert first is not None and second is not None

    # Act — the loser's update is rejected, not silently merged
    first.name = "Manual v2"
    await sut.save(first)
    second.name = "Manual v3"
    with pytest.raises(StaleDataError):
        await sut.save(second)

    # Assert — no lost update: the row still holds the winner's value
    await db_session.rollback()
    survivor = await sut.find_by_id(stored.id)
    assert survivor is not None
    assert survivor.name == "Manual v2"
    assert survivor.version == 2


async def test_saving_again_with_the_refreshed_version_succeeds(db_session: AsyncSession) -> None:
    # Arrange — the caller re-reads after losing the race
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    stored = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))
    assert stored.id is not None
    stored.name = "Manual v2"
    await sut.save(stored)

    # Act
    refreshed = await sut.find_by_id(stored.id)
    assert refreshed is not None
    refreshed.name = "Manual v3"
    updated = await sut.save(refreshed)

    # Assert
    assert updated.name == "Manual v3"
    assert updated.version == 3
