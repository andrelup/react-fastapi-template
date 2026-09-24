"""Unit tests for `CollectionService`: role-only authorization, no ownership.

The port is satisfied by `FakeCollectionRepository` (`tests/fakes/`), never a
mock, so the test asserts against the real contract — including the
optimistic lock, which the fake replicates exactly as PostgreSQL enforces it.
Compare with `FakeItemRepository` in `test_item_service.py`: same shape, no
`owner_id`.
"""

from dataclasses import replace

import pytest
from sqlalchemy.orm.exc import StaleDataError
from src.domain.exceptions import (
    CollectionNotFoundError,
    DuplicateCollectionNameError,
    ForbiddenError,
)
from src.domain.models.example.collection import Collection
from src.domain.models.user import User, UserRole
from src.domain.services.example.collection_service import CollectionService

from tests.fakes.fake_collection_repository import FakeCollectionRepository


def _user(user_id: int, role: UserRole) -> User:
    return User(
        id=user_id,
        email=f"user{user_id}@example.com",
        name=f"User {user_id}",
        role=role,
        hashed_password="hashed:pw",
    )


def _collection(
    collection_id: int | None, name: str = "Guias de incorporacion", version: int = 1
) -> Collection:
    return Collection(
        id=collection_id, name=name, description="Documentos de bienvenida", version=version
    )


# --- list and get -----------------------------------------------------------


async def test_list_collections_returns_the_page_and_the_total() -> None:
    # Arrange
    sut = CollectionService(
        FakeCollectionRepository([_collection(1, "a"), _collection(2, "b"), _collection(3, "c")])
    )

    # Act
    collections, total = await sut.list_collections(page=1, page_size=2)

    # Assert
    assert total == 3
    assert len(collections) == 2


async def test_get_collection_returns_the_collection() -> None:
    # Arrange
    sut = CollectionService(FakeCollectionRepository([_collection(10, "manual")]))

    # Act
    found = await sut.get_collection(10)

    # Assert
    assert found.name == "manual"


async def test_get_collection_when_it_does_not_exist_raises_collection_not_found_error() -> None:
    # Arrange
    sut = CollectionService(FakeCollectionRepository())

    # Act & Assert
    with pytest.raises(CollectionNotFoundError):
        await sut.get_collection(404)


# --- create -------------------------------------------------------------------


async def test_create_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = CollectionService(FakeCollectionRepository())

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.create(_collection(None), viewer)


async def test_create_as_editor_raises_forbidden_error() -> None:
    # Arrange — unlike `Item`, an EDITOR may not govern the collections catalogue
    editor = _user(1, UserRole.EDITOR)
    sut = CollectionService(FakeCollectionRepository())

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.create(_collection(None), editor)


async def test_create_as_admin_is_allowed() -> None:
    # Arrange
    admin = _user(1, UserRole.ADMIN)
    sut = CollectionService(FakeCollectionRepository())

    # Act
    created = await sut.create(_collection(None), admin)

    # Assert
    assert created.id is not None
    assert created.version == 1


async def test_create_with_a_taken_name_raises_duplicate_collection_name_error() -> None:
    # Arrange
    admin = _user(1, UserRole.ADMIN)
    sut = CollectionService(FakeCollectionRepository([_collection(1, "manual")]))

    # Act & Assert
    with pytest.raises(DuplicateCollectionNameError):
        await sut.create(_collection(None, "manual"), admin)


# --- update -------------------------------------------------------------------


async def test_update_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = CollectionService(FakeCollectionRepository([_collection(10)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.update(10, _collection(10), viewer)


async def test_update_as_editor_raises_forbidden_error() -> None:
    # Arrange
    editor = _user(1, UserRole.EDITOR)
    sut = CollectionService(FakeCollectionRepository([_collection(10)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.update(10, _collection(10), editor)


async def test_update_as_admin_applies_the_changes() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    sut = CollectionService(FakeCollectionRepository([_collection(10, "manual")]))
    changes = replace(_collection(10, "manual"), description="Nueva descripcion")

    # Act
    updated = await sut.update(10, changes, admin)

    # Assert
    assert updated.description == "Nueva descripcion"
    assert updated.version == 2


async def test_update_when_the_collection_does_not_exist_raises_collection_not_found_error() -> (
    None
):
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    sut = CollectionService(FakeCollectionRepository())

    # Act & Assert
    with pytest.raises(CollectionNotFoundError):
        await sut.update(404, _collection(404), admin)


async def test_update_with_a_stale_version_raises_stale_data_error() -> None:
    # Arrange — the stored collection has already moved on to version 2
    admin = _user(9, UserRole.ADMIN)
    sut = CollectionService(FakeCollectionRepository([_collection(10, "manual", version=2)]))

    # Act & Assert — the client still holds version 1
    with pytest.raises(StaleDataError):
        await sut.update(10, _collection(10, "manual", version=1), admin)


async def test_update_to_a_name_owned_by_another_collection_raises_duplicate_name_error() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    repository = FakeCollectionRepository([_collection(10, "manual"), _collection(11, "otra")])
    sut = CollectionService(repository)

    # Act & Assert
    with pytest.raises(DuplicateCollectionNameError):
        await sut.update(10, _collection(10, "otra"), admin)


async def test_update_keeping_its_own_name_does_not_check_for_duplicates() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    sut = CollectionService(FakeCollectionRepository([_collection(10, "manual")]))

    # Act
    updated = await sut.update(
        10, replace(_collection(10, "manual"), description="Otra descripcion"), admin
    )

    # Assert
    assert updated.name == "manual"


# --- delete -------------------------------------------------------------------


async def test_delete_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = CollectionService(FakeCollectionRepository([_collection(10)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.delete(10, viewer)


async def test_delete_as_editor_raises_forbidden_error() -> None:
    # Arrange
    editor = _user(1, UserRole.EDITOR)
    sut = CollectionService(FakeCollectionRepository([_collection(10)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.delete(10, editor)


async def test_delete_as_admin_removes_the_collection() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    repository = FakeCollectionRepository([_collection(10)])
    sut = CollectionService(repository)

    # Act
    await sut.delete(10, admin)

    # Assert
    assert await repository.find_by_id(10) is None


async def test_delete_an_unknown_collection_as_viewer_returns_not_found_not_forbidden() -> None:
    # Arrange — existence is checked before the role, so the error code never
    # leaks whether the row exists, mirroring `ItemService.delete`
    viewer = _user(1, UserRole.VIEWER)
    sut = CollectionService(FakeCollectionRepository())

    # Act & Assert
    with pytest.raises(CollectionNotFoundError):
        await sut.delete(404, viewer)
