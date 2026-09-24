"""Integration tests for `SqlAlchemyCollectionRepository`, against a real Postgres DB.

Each test runs inside a transaction rolled back by the `db_session` fixture,
so no data is left behind between runs. The `collections` table must exist —
run `alembic upgrade head` before the suite.

Several tests also exercise `SqlAlchemyItemRepository`, because what they
prove is really about the `items` <-> `collections` relationship: the
optimistic lock across the association, the reconciliation of link rows, and
that deleting a collection does not cascade onto the items that belonged to
it. That behaviour has no other natural home than the collection's own
integration suite.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError
from src.adapters.outbound.persistence.example.collection_repository import (
    SqlAlchemyCollectionRepository,
)
from src.adapters.outbound.persistence.example.item_repository import SqlAlchemyItemRepository
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.domain.models.example.collection import Collection, CollectionRef
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole


async def _an_owner(db_session: AsyncSession, email: str = "collections-owner@example.com") -> int:
    """Insert a user and return its id, for use as `items.owner_id`."""
    saved = await SqlAlchemyUserRepository(db_session).save(
        User(email=email, name="Owner", role=UserRole.EDITOR, hashed_password="hashed:pw")
    )
    assert saved.id is not None
    return saved.id


# --- save / find round trip -------------------------------------------------


async def test_save_inserts_a_new_collection_and_assigns_an_id(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)

    # Act
    saved = await sut.save(Collection(name="Guias", description="Documentos de bienvenida"))

    # Assert
    assert saved.id is not None
    assert saved.version == 1
    assert saved.description == "Documentos de bienvenida"


async def test_find_by_id_returns_the_matching_collection(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    saved = await sut.save(Collection(name="Guias"))
    assert saved.id is not None

    # Act
    found = await sut.find_by_id(saved.id)

    # Assert
    assert found is not None
    assert found.name == "Guias"


async def test_find_by_id_when_not_found_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)

    # Act
    found = await sut.find_by_id(987654)

    # Assert
    assert found is None


async def test_find_by_name_returns_the_matching_collection(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    await sut.save(Collection(name="Plantillas"))

    # Act
    found = await sut.find_by_name("Plantillas")

    # Assert
    assert found is not None
    assert found.name == "Plantillas"


async def test_find_by_name_when_not_found_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)

    # Act
    found = await sut.find_by_name("no-existe")

    # Assert
    assert found is None


async def test_find_by_ids_returns_the_matches_and_silently_omits_unknown_ids(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    first = await sut.save(Collection(name="Una"))
    second = await sut.save(Collection(name="Dos"))
    assert first.id is not None and second.id is not None

    # Act
    found = await sut.find_by_ids([first.id, second.id, 987654])

    # Assert — the unknown id is silently skipped, not raised here: that is
    # the service's job, per `ItemService.set_collections`.
    assert {collection.id for collection in found} == {first.id, second.id}


async def test_find_by_ids_with_an_empty_list_returns_an_empty_list(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    await sut.save(Collection(name="Una"))

    # Act
    found = await sut.find_by_ids([])

    # Assert
    assert found == []


# --- find_all: pagination, ordering, total ----------------------------------


async def test_find_all_orders_by_name_and_reports_the_total(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    await sut.save(Collection(name="Zeta"))
    await sut.save(Collection(name="Alfa"))
    await sut.save(Collection(name="Mu"))

    # Act
    collections, total = await sut.find_all(page=1, page_size=20)

    # Assert
    assert total == 3
    assert [collection.name for collection in collections] == ["Alfa", "Mu", "Zeta"]


async def test_find_all_paginates_using_a_1_indexed_page(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    for name in ["Alfa", "Beta", "Gamma"]:
        await sut.save(Collection(name=name))

    # Act — page 2 of size 1 -> offset 1, limit 1 -> the second in name order
    collections, total = await sut.find_all(page=2, page_size=1)

    # Assert
    assert total == 3
    assert len(collections) == 1
    assert collections[0].name == "Beta"


# --- optimistic locking ------------------------------------------------------


async def test_save_updates_the_scalar_fields_and_bumps_the_version(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    saved = await sut.save(Collection(name="Guias"))
    assert saved.id is not None

    # Act
    saved.description = "Actualizada"
    updated = await sut.save(saved)

    # Assert
    assert updated.description == "Actualizada"
    assert updated.version == 2


async def test_save_with_a_stale_version_raises_stale_data_error(db_session: AsyncSession) -> None:
    # Arrange — two callers read the same collection
    sut = SqlAlchemyCollectionRepository(db_session)
    stored = await sut.save(Collection(name="Guias"))
    assert stored.id is not None
    first = await sut.find_by_id(stored.id)
    second = await sut.find_by_id(stored.id)

    # Act — the first write wins and bumps the version
    assert first is not None and second is not None
    first.description = "Primera"
    await sut.save(first)

    # Assert — the second write is working from a version that no longer exists
    second.description = "Segunda"
    with pytest.raises(StaleDataError):
        await sut.save(second)


async def test_save_a_collection_whose_id_does_not_exist_raises_value_error(
    db_session: AsyncSession,
) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)

    # Act & Assert
    with pytest.raises(ValueError, match="does not exist"):
        await sut.save(Collection(id=987654, name="Fantasma"))


# --- delete -------------------------------------------------------------------


async def test_delete_removes_the_collection(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)
    saved = await sut.save(Collection(name="Guias"))
    assert saved.id is not None

    # Act
    await sut.delete(saved.id)

    # Assert
    assert await sut.find_by_id(saved.id) is None


async def test_delete_a_missing_collection_is_a_no_op(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyCollectionRepository(db_session)

    # Act & Assert — no exception
    await sut.delete(987654)


async def test_delete_a_collection_leaves_its_items_alive(db_session: AsyncSession) -> None:
    # Arrange — the `ON DELETE CASCADE` on `item_collections` targets the
    # association rows only; there is deliberately no
    # `cascade="all, delete-orphan"` on the `secondary` relationship, which
    # would delete the item itself instead of the link.
    collection_sut = SqlAlchemyCollectionRepository(db_session)
    item_sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    collection = await collection_sut.save(Collection(name="Efimera"))
    assert collection.id is not None
    item = await item_sut.save(
        Item(
            name="Manual",
            slug="manual-coleccion-borrada",
            owner_id=owner_id,
            collections=[CollectionRef(id=collection.id, name=collection.name)],
        )
    )
    assert item.id is not None

    # Act
    await collection_sut.delete(collection.id)

    # Assert — the item still exists, only the association row is gone
    survivor = await item_sut.find_by_id(item.id)
    assert survivor is not None
    assert survivor.name == "Manual"
    assert survivor.collections == []
    assert await collection_sut.find_by_id(collection.id) is None


# --- membership through ItemRepository: version and reconciliation ----------


async def test_save_a_new_item_with_collections_is_born_at_version_1(
    db_session: AsyncSession,
) -> None:
    # Arrange — an INSERT already writes version 1: linking collections must
    # not append a second UPDATE to the same flush (the #36 `flag_modified`
    # correction, now guarded for collections too).
    collection_sut = SqlAlchemyCollectionRepository(db_session)
    item_sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    collection = await collection_sut.save(Collection(name="Nueva"))
    assert collection.id is not None

    # Act
    saved = await item_sut.save(
        Item(
            name="Manual",
            slug="manual-nuevo-con-coleccion",
            owner_id=owner_id,
            collections=[CollectionRef(id=collection.id, name=collection.name)],
        )
    )

    # Assert
    assert saved.version == 1
    assert saved.collections == [CollectionRef(id=collection.id, name=collection.name)]


async def test_save_advances_the_version_by_exactly_one_when_only_collections_change(
    db_session: AsyncSession,
) -> None:
    # Arrange — no column on `items` changes here, only the link rows
    collection_sut = SqlAlchemyCollectionRepository(db_session)
    item_sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    collection = await collection_sut.save(Collection(name="Solitaria"))
    assert collection.id is not None
    saved = await item_sut.save(
        Item(name="Manual", slug="manual-un-cambio-membresia", owner_id=owner_id)
    )
    assert saved.id is not None

    # Act
    saved.collections = [CollectionRef(id=collection.id, name=collection.name)]
    updated = await item_sut.save(saved)

    # Assert — `flag_modified` is what forces the UPDATE, and with it the
    # single bump; `no_autoflush` is what keeps it from becoming two.
    assert updated.collections == [CollectionRef(id=collection.id, name=collection.name)]
    assert updated.version == saved.version + 1 == 2


async def test_save_reconciles_collections_keeping_the_link_that_stays(
    db_session: AsyncSession,
) -> None:
    # Arrange
    collection_sut = SqlAlchemyCollectionRepository(db_session)
    item_sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    stays = await collection_sut.save(Collection(name="Se-queda"))
    leaves = await collection_sut.save(Collection(name="Se-va"))
    arrives = await collection_sut.save(Collection(name="Llega"))
    assert stays.id is not None and leaves.id is not None and arrives.id is not None
    saved = await item_sut.save(
        Item(
            name="Manual",
            slug="manual-reconciliacion",
            owner_id=owner_id,
            collections=[
                CollectionRef(id=stays.id, name=stays.name),
                CollectionRef(id=leaves.id, name=leaves.name),
            ],
        )
    )

    # Act — drop `leaves`, keep `stays`, add `arrives`
    saved.collections = [
        CollectionRef(id=stays.id, name=stays.name),
        CollectionRef(id=arrives.id, name=arrives.name),
    ]
    updated = await item_sut.save(saved)

    # Assert — `order_by="CollectionORM.name"` makes this stable
    assert [ref.name for ref in updated.collections] == ["Llega", "Se-queda"]


async def test_save_advances_the_version_by_exactly_one_when_tags_and_collections_both_change(
    db_session: AsyncSession,
) -> None:
    # Arrange — both reconciliations must share a single `no_autoflush` block
    # and a single `flag_modified` call, or the version would advance twice.
    collection_sut = SqlAlchemyCollectionRepository(db_session)
    item_sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    collection = await collection_sut.save(Collection(name="Combinada"))
    assert collection.id is not None
    saved = await item_sut.save(
        Item(name="Manual", slug="manual-tags-y-colecciones", owner_id=owner_id)
    )
    assert saved.id is not None

    # Act
    saved.tag_names = ["nueva-tag"]
    saved.collections = [CollectionRef(id=collection.id, name=collection.name)]
    updated = await item_sut.save(saved)

    # Assert
    assert updated.tag_names == ["nueva-tag"]
    assert updated.collections == [CollectionRef(id=collection.id, name=collection.name)]
    assert updated.version == saved.version + 1 == 2


async def test_save_with_an_unknown_collection_id_raises_value_error(
    db_session: AsyncSession,
) -> None:
    # Arrange — `_reconcile_collections` does not get-or-create, unlike
    # `_reconcile_tags`: ids are expected to already be validated by
    # `ItemService.set_collections`. This proves the repository's own guard
    # for a caller that bypasses the service.
    item_sut = SqlAlchemyItemRepository(db_session)
    owner_id = await _an_owner(db_session)
    saved = await item_sut.save(
        Item(name="Manual", slug="manual-coleccion-inexistente", owner_id=owner_id)
    )
    assert saved.id is not None

    # Act & Assert
    saved.collections = [CollectionRef(id=987654, name="Fantasma")]
    with pytest.raises(ValueError, match="does not exist"):
        await item_sut.save(saved)
