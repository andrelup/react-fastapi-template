"""Integration tests for SqlAlchemyItemRepository, against a real Postgres DB.

Each test runs inside a transaction rolled back by the `db_session`
fixture, so no data is left behind between runs. The `items` table must
exist — run `alembic upgrade head` before the suite.

Every item needs a real owner: `items.owner_id` is a foreign key against
`users`, so each test inserts the user it needs first.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.example.item_repository import SqlAlchemyItemRepository
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole


async def _an_owner(db_session: AsyncSession, email: str = "owner@example.com") -> int:
    """Insert a user and return its id, for use as `items.owner_id`."""
    saved = await SqlAlchemyUserRepository(db_session).save(
        User(email=email, name="Owner", role=UserRole.EDITOR, hashed_password="hashed:pw")
    )
    assert saved.id is not None
    return saved.id


async def test_save_inserts_a_new_item_and_assigns_an_id(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)

    # Act
    saved = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))

    # Assert
    assert saved.id is not None
    assert saved.version == 1
    assert saved.owner_id == owner_id


async def test_save_creates_the_tags_it_does_not_find(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)

    # Act
    saved = await sut.save(
        Item(
            name="Manual",
            slug="manual-con-tags",
            owner_id=owner_id,
            tag_names=["onboarding", "interno"],
        )
    )

    # Assert — `order_by="TagORM.name"` on the relationship makes this stable
    assert saved.tag_names == ["interno", "onboarding"]
    # An INSERT writes version 1 and nothing else: linking the tags must not
    # append a second UPDATE to the same flush.
    assert saved.version == 1


async def test_save_reuses_an_existing_tag_across_items(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    await sut.save(Item(name="Uno", slug="uno", owner_id=owner_id, tag_names=["comun"]))

    # Act
    second = await sut.save(Item(name="Dos", slug="dos", owner_id=owner_id, tag_names=["comun"]))

    # Assert — the tag is resolved by natural key, not duplicated
    assert second.tag_names == ["comun"]


async def test_find_by_id_returns_the_matching_item(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    saved = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))
    assert saved.id is not None

    # Act
    found = await sut.find_by_id(saved.id)

    # Assert
    assert found is not None
    assert found.slug == "manual"


async def test_find_by_id_when_not_found_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)

    # Act
    found = await sut.find_by_id(987654)

    # Assert
    assert found is None


async def test_find_by_slug_returns_the_matching_item(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    await sut.save(Item(name="Manual", slug="manual-unico", owner_id=owner_id))

    # Act
    found = await sut.find_by_slug("manual-unico")

    # Assert
    assert found is not None
    assert found.name == "Manual"


async def test_find_by_slug_when_not_found_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)

    # Act
    found = await sut.find_by_slug("no-existe")

    # Assert
    assert found is None


async def test_search_matches_the_query_against_name_and_description(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    await sut.save(Item(name="Manual de bienvenida", slug="s-uno", owner_id=owner_id))
    await sut.save(
        Item(name="Otra cosa", slug="s-dos", owner_id=owner_id, description="con bienvenida dentro")
    )
    await sut.save(Item(name="Sin relacion", slug="s-tres", owner_id=owner_id))

    # Act — ILIKE, so the case does not matter
    items, total = await sut.search("BIENVENIDA", None, offset=0, limit=20)

    # Assert
    assert total == 2
    assert {item.slug for item in items} == {"s-uno", "s-dos"}


async def test_search_narrows_by_category(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    await sut.save(Item(name="Uno", slug="c-uno", owner_id=owner_id, category="documentacion"))
    await sut.save(Item(name="Dos", slug="c-dos", owner_id=owner_id, category="plantilla"))

    # Act
    items, total = await sut.search(None, "plantilla", offset=0, limit=20)

    # Assert
    assert total == 1
    assert items[0].slug == "c-dos"


async def test_search_paginates_and_still_reports_the_full_total(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    for index in range(3):
        await sut.save(Item(name=f"Pag {index}", slug=f"pag-{index}", owner_id=owner_id))

    # Act
    items, total = await sut.search("Pag", None, offset=1, limit=1)

    # Assert — ordered by name, so offset 1 is the second one
    assert total == 3
    assert len(items) == 1
    assert items[0].name == "Pag 1"


async def test_save_updates_the_scalar_fields_and_bumps_the_version(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    saved = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))
    assert saved.id is not None

    # Act
    saved.name = "Manual v2"
    saved.description = "Revisado"
    updated = await sut.save(saved)

    # Assert
    assert updated.name == "Manual v2"
    assert updated.description == "Revisado"
    assert updated.version == 2


async def test_save_advances_the_version_when_only_the_tags_change(
    db_session: AsyncSession,
) -> None:
    # Arrange — no column on `items` changes here, only the link rows
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    saved = await sut.save(
        Item(name="Manual", slug="manual", owner_id=owner_id, tag_names=["viejo"])
    )

    # Act
    saved.tag_names = ["nuevo"]
    updated = await sut.save(saved)

    # Assert — `flag_modified` is what forces the UPDATE, and with it the bump
    assert updated.tag_names == ["nuevo"]
    assert updated.version == 2


async def test_save_keeps_the_tags_that_stay(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    saved = await sut.save(
        Item(name="Manual", slug="manual", owner_id=owner_id, tag_names=["queda", "se-va"])
    )

    # Act
    saved.tag_names = ["queda", "llega"]
    updated = await sut.save(saved)

    # Assert
    assert updated.tag_names == ["llega", "queda"]


async def test_save_an_item_whose_id_does_not_exist_raises_value_error(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)

    # Act & Assert
    with pytest.raises(ValueError, match="does not exist"):
        await sut.save(Item(id=987654, name="Fantasma", slug="fantasma", owner_id=owner_id))


async def test_delete_removes_the_item(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    saved = await sut.save(Item(name="Manual", slug="manual", owner_id=owner_id))
    assert saved.id is not None

    # Act
    await sut.delete(saved.id)

    # Assert
    assert await sut.find_by_id(saved.id) is None


async def test_delete_a_missing_item_is_a_no_op(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyItemRepository(db_session)

    # Act & Assert — no exception
    await sut.delete(987654)
