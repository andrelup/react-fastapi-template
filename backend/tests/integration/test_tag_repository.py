"""Integration tests for `SqlAlchemyTagRepository`, against a real Postgres DB.

Each test runs inside a transaction rolled back by the `db_session` fixture,
so no data is left behind between runs. The `tags` table must exist — run
`alembic upgrade head` before the suite.
"""

from typing import Any

from sqlalchemy import Select, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.example.tag import TagORM
from src.adapters.outbound.persistence.example.tag_repository import SqlAlchemyTagRepository

# --- search -------------------------------------------------------------------


async def test_search_with_no_query_returns_up_to_the_limit_ordered_by_name(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyTagRepository(db_session)
    for name in ["zeta", "alfa", "mu"]:
        await sut.get_or_create(name)

    # Act
    tags = await sut.search(None, limit=2)

    # Assert — first 2 by name, exactly what a dropdown shows before typing anything
    assert [tag.name for tag in tags] == ["alfa", "mu"]


async def test_search_with_a_query_returns_the_matches(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyTagRepository(db_session)
    await sut.get_or_create("onboarding")
    await sut.get_or_create("interno")

    # Act
    tags = await sut.search("board", limit=50)

    # Assert
    assert [tag.name for tag in tags] == ["onboarding"]


async def test_search_includes_tags_attached_to_no_item(db_session: AsyncSession) -> None:
    # Arrange — deliberately no join against `item_tags`: an orphan tag is
    # still a real row in the vocabulary, per issue #62
    sut = SqlAlchemyTagRepository(db_session)
    await sut.get_or_create("huerfana")

    # Act
    tags = await sut.search("huerfana", limit=50)

    # Assert
    assert [tag.name for tag in tags] == ["huerfana"]


async def test_search_with_no_matches_returns_an_empty_list(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyTagRepository(db_session)
    await sut.get_or_create("onboarding")

    # Act
    tags = await sut.search("no-existe", limit=50)

    # Assert
    assert tags == []


# --- get_or_create: new name and existing name -------------------------------


async def test_get_or_create_with_a_new_name_creates_it_and_returns_true(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyTagRepository(db_session)

    # Act
    tag, created = await sut.get_or_create("nueva")

    # Assert
    assert created is True
    assert tag.id is not None
    assert tag.name == "nueva"


async def test_get_or_create_with_an_existing_name_returns_it_and_false(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyTagRepository(db_session)
    first, _ = await sut.get_or_create("repetida")

    # Act
    second, created = await sut.get_or_create("repetida")

    # Assert — same row, not a duplicate
    assert created is False
    assert second.id == first.id


# --- get_or_create: the unique-constraint race -------------------------------
#
# The three `get_or_create` paths the issue asks integration coverage for are
# "new name", "existing name" (both above) and "the clash with `unique`". The
# clash is the hard one, and this comment records why it is tested the way it
# is below rather than with two coroutines and `asyncio.gather`.
#
# The `db_session` fixture is a single `AsyncConnection` wrapped in one
# `AsyncSession` (`join_transaction_mode="create_savepoint"`, see
# `tests/conftest.py`). Two coroutines sharing it cannot race: everything runs
# in program order on that one connection, so there is no window for a second
# INSERT to land between this method's own SELECT and its own INSERT.
#
# Two independent connections would produce a *real* race, but whether it
# actually lands on the `except IntegrityError` branch then depends on
# whichever of two real network round trips (the two SELECTs) happens to
# finish first relative to the other's INSERT — timing this repository has no
# control over and a test has no deterministic hook into, short of adding a
# seam to production code purely to make a test pass, which the brief for
# this issue rules out. That is flaky coverage in a suite that has to stay
# green in CI, and a test that only sometimes exercises the branch it is
# named after is worse than an honestly-uncovered one.
#
# What follows instead reproduces the *exact* interleaving deterministically,
# on the single connection the fixture already provides, without touching
# `tag_repository.py`: it patches this one `AsyncSession` instance so that the
# moment `get_or_create`'s own lookup SELECT returns empty, a second, ordinary
# INSERT for the same name is executed and released as a savepoint — see
# `conftest.py` — before `get_or_create` gets to run its own INSERT. Postgres's
# unique index on `tags.name` does not care that both statements came from the
# same session: the second one collides for real, and it is `get_or_create`'s
# own `except IntegrityError` handling — not the test — that turns the
# collision into the winning row. `rollback()` on a savepoint-joined session
# is safe and leaves the earlier, already-released insert intact —
# `test_optimistic_locking.py:78` already relies on the same fact after a
# `StaleDataError` — which is what lets the post-rollback re-read below find
# the row.
#
# This is not a substitute for the two-connection scenario the issue
# describes; it is a deterministic reproduction of the one interleaving that
# scenario can produce, exercised through the real production code path and
# a real Postgres unique-constraint violation rather than a mock.


async def test_get_or_create_when_a_concurrent_insert_wins_the_unique_race(
    db_session: AsyncSession,
) -> None:
    # Arrange — intercept this session's own `execute`, so that the instant
    # `get_or_create`'s lookup SELECT comes back empty, a competing INSERT for
    # the same name is committed first, on the very same connection.
    sut = SqlAlchemyTagRepository(db_session)
    original_execute = db_session.execute
    injected = False

    async def _execute_and_inject_once(statement: Any, *args: Any, **kwargs: Any) -> Any:
        nonlocal injected
        result = await original_execute(statement, *args, **kwargs)
        if not injected and isinstance(statement, Select):
            injected = True
            await original_execute(insert(TagORM).values(name="carrera"))
            await db_session.commit()
        return result

    db_session.execute = _execute_and_inject_once  # type: ignore[method-assign]

    # Act — from `get_or_create`'s point of view it ran its own SELECT (found
    # nothing), then its own INSERT — which collided with a row it never saw
    tag, created = await sut.get_or_create("carrera")

    # Assert — the constraint's loser reports the winner's row, not a 409
    assert created is False
    assert tag.name == "carrera"

    db_session.execute = original_execute  # type: ignore[method-assign]
    result = await db_session.execute(select(TagORM).where(TagORM.name == "carrera"))
    assert len(result.scalars().all()) == 1
