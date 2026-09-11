"""Unit tests for `ItemService`: the catalogue's authorization matrix and its use cases.

The port is satisfied by a hand-written in-memory fake, never a mock, so the
test asserts against the real contract — including the optimistic lock, which
the fake replicates exactly as PostgreSQL enforces it.
"""

from dataclasses import replace

import pytest
from sqlalchemy.orm.exc import StaleDataError
from src.domain.exceptions import DuplicateSlugError, ForbiddenError, ItemNotFoundError
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole
from src.domain.services.example.item_service import ItemService


def _copy(item: Item) -> Item:
    """Return an independent copy, mutable list field included."""
    return replace(item, tag_names=list(item.tag_names))


class FakeItemRepository:
    """In-memory `ItemRepository`, including the version check PostgreSQL does for real.

    Every method hands out copies, exactly as the SQLAlchemy repository does:
    its `_to_domain` builds a fresh `Item` on every read. Returning the stored
    instance instead would make the caller's mutations land straight in the
    store, and the version comparison in `save` would end up comparing an
    object with itself and never fire.
    """

    def __init__(self, items: list[Item] | None = None) -> None:
        self._items = {item.id: _copy(item) for item in items or [] if item.id is not None}
        self._next_id = max(self._items, default=0) + 1

    async def find_by_id(self, item_id: int) -> Item | None:
        stored = self._items.get(item_id)
        return _copy(stored) if stored is not None else None

    async def find_by_slug(self, slug: str) -> Item | None:
        stored = next((item for item in self._items.values() if item.slug == slug), None)
        return _copy(stored) if stored is not None else None

    async def search(
        self, query: str | None, category: str | None, offset: int, limit: int
    ) -> tuple[list[Item], int]:
        matches = [
            item
            for item in self._items.values()
            if (query is None or query.lower() in item.name.lower())
            and (category is None or item.category == category)
        ]
        return [_copy(item) for item in matches[offset : offset + limit]], len(matches)

    async def save(self, item: Item) -> Item:
        if item.id is None:
            stored = replace(_copy(item), id=self._next_id)
            self._next_id += 1
        else:
            current = self._items[item.id]
            if current.version != item.version:
                raise StaleDataError("UPDATE statement on table 'items' expected to update 1 row")
            stored = replace(_copy(item), version=item.version + 1)
        if stored.id is None:
            raise ValueError("A stored item always has an id")
        self._items[stored.id] = stored
        return _copy(stored)

    async def delete(self, item_id: int) -> None:
        self._items.pop(item_id, None)


def _user(user_id: int, role: UserRole) -> User:
    return User(
        id=user_id,
        email=f"user{user_id}@example.com",
        name=f"User {user_id}",
        role=role,
        hashed_password="hashed:pw",
    )


def _item(item_id: int | None, owner_id: int, slug: str = "manual", version: int = 1) -> Item:
    return Item(
        id=item_id,
        name="Manual de bienvenida",
        slug=slug,
        owner_id=owner_id,
        description="Guia de incorporacion",
        category="documentacion",
        version=version,
    )


# --- search and get -------------------------------------------------------


async def test_search_returns_the_page_and_the_total() -> None:
    # Arrange
    sut = ItemService(FakeItemRepository([_item(1, 1, "a"), _item(2, 1, "b"), _item(3, 1, "c")]))

    # Act
    items, total = await sut.search(None, None, offset=1, limit=1)

    # Assert
    assert total == 3
    assert len(items) == 1


async def test_search_narrows_by_category() -> None:
    # Arrange
    other = replace(_item(2, 1, "b"), category="otra")
    sut = ItemService(FakeItemRepository([_item(1, 1, "a"), other]))

    # Act
    items, total = await sut.search(None, "otra", offset=0, limit=20)

    # Assert
    assert total == 1
    assert items[0].slug == "b"


async def test_get_returns_the_item() -> None:
    # Arrange
    sut = ItemService(FakeItemRepository([_item(10, 1)]))

    # Act
    found = await sut.get(10)

    # Assert
    assert found.slug == "manual"


async def test_get_when_the_item_does_not_exist_raises_item_not_found_error() -> None:
    # Arrange
    sut = ItemService(FakeItemRepository())

    # Act & Assert
    with pytest.raises(ItemNotFoundError):
        await sut.get(404)


# --- create ---------------------------------------------------------------


async def test_create_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = ItemService(FakeItemRepository())

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.create(_item(None, 0), viewer)


async def test_create_as_editor_assigns_ownership_to_the_authenticated_user() -> None:
    # Arrange
    editor = _user(7, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository())

    # Act
    created = await sut.create(_item(None, 0), editor)

    # Assert
    assert created.id is not None
    assert created.owner_id == 7
    assert created.version == 1


async def test_create_as_admin_is_allowed() -> None:
    # Arrange
    admin = _user(1, UserRole.ADMIN)
    sut = ItemService(FakeItemRepository())

    # Act
    created = await sut.create(_item(None, 0), admin)

    # Assert
    assert created.owner_id == 1


async def test_create_with_a_taken_slug_raises_duplicate_slug_error() -> None:
    # Arrange
    editor = _user(1, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(1, 2, "manual")]))

    # Act & Assert
    with pytest.raises(DuplicateSlugError):
        await sut.create(_item(None, 0, "manual"), editor)


async def test_create_with_an_unpersisted_user_raises_value_error() -> None:
    # Arrange
    ghost = User(
        id=None, email="g@example.com", name="G", role=UserRole.EDITOR, hashed_password="hashed:pw"
    )
    sut = ItemService(FakeItemRepository())

    # Act & Assert
    with pytest.raises(ValueError, match="must be persisted"):
        await sut.create(_item(None, 0), ghost)


# --- update ---------------------------------------------------------------


async def test_update_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = ItemService(FakeItemRepository([_item(10, 1)]))

    # Act & Assert — owning the item does not help: a VIEWER writes nothing
    with pytest.raises(ForbiddenError):
        await sut.update(10, _item(10, 1), viewer)


async def test_update_when_editor_does_not_own_the_item_raises_forbidden_error() -> None:
    # Arrange
    intruder = _user(2, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(10, 1)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.update(10, _item(10, 1), intruder)


async def test_update_when_editor_owns_the_item_applies_the_changes() -> None:
    # Arrange
    owner = _user(1, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(10, 1)]))
    changes = replace(_item(10, 1), name="Manual v2", tag_names=["onboarding"])

    # Act
    updated = await sut.update(10, changes, owner)

    # Assert
    assert updated.name == "Manual v2"
    assert updated.tag_names == ["onboarding"]
    assert updated.version == 2


async def test_update_as_admin_on_an_item_it_does_not_own_applies_the_changes() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    sut = ItemService(FakeItemRepository([_item(10, 1)]))

    # Act
    updated = await sut.update(10, replace(_item(10, 1), name="Intervenido"), admin)

    # Assert
    assert updated.name == "Intervenido"


async def test_update_when_the_item_does_not_exist_raises_item_not_found_error() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    sut = ItemService(FakeItemRepository())

    # Act & Assert
    with pytest.raises(ItemNotFoundError):
        await sut.update(404, _item(404, 1), admin)


async def test_update_with_a_stale_version_raises_stale_data_error() -> None:
    # Arrange — the stored item has already moved on to version 2
    owner = _user(1, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(10, 1, version=2)]))

    # Act & Assert — the client still holds version 1
    with pytest.raises(StaleDataError):
        await sut.update(10, _item(10, 1, version=1), owner)


async def test_update_to_a_slug_owned_by_another_item_raises_duplicate_slug_error() -> None:
    # Arrange
    owner = _user(1, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(10, 1, "manual"), _item(11, 1, "otro")]))

    # Act & Assert
    with pytest.raises(DuplicateSlugError):
        await sut.update(10, _item(10, 1, "otro"), owner)


async def test_update_keeping_its_own_slug_does_not_check_for_duplicates() -> None:
    # Arrange
    owner = _user(1, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(10, 1, "manual")]))

    # Act
    updated = await sut.update(10, replace(_item(10, 1, "manual"), name="Otro nombre"), owner)

    # Assert
    assert updated.slug == "manual"


# --- delete ---------------------------------------------------------------


async def test_delete_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = ItemService(FakeItemRepository([_item(10, 1)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.delete(10, viewer)


async def test_delete_as_editor_raises_forbidden_error_even_on_its_own_item() -> None:
    # Arrange — deleting is an ADMIN privilege across the whole system
    owner = _user(1, UserRole.EDITOR)
    sut = ItemService(FakeItemRepository([_item(10, 1)]))

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.delete(10, owner)


async def test_delete_as_admin_removes_the_item() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    repository = FakeItemRepository([_item(10, 1)])
    sut = ItemService(repository)

    # Act
    await sut.delete(10, admin)

    # Assert
    assert await repository.find_by_id(10) is None


async def test_delete_a_missing_item_as_viewer_raises_item_not_found_not_forbidden() -> None:
    # Arrange — existence is checked before the role, so the error code never
    # leaks whether the row exists
    viewer = _user(1, UserRole.VIEWER)
    sut = ItemService(FakeItemRepository())

    # Act & Assert
    with pytest.raises(ItemNotFoundError):
        await sut.delete(404, viewer)
