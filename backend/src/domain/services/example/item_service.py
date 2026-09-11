"""Item use cases: search, creation, update and deletion, with authorization."""

from src.domain.exceptions import DuplicateSlugError, ForbiddenError, ItemNotFoundError
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole, has_role
from src.domain.ports.example.repositories import ItemRepository


class ItemService:
    """Coordinates the item use cases and enforces the catalogue's authorization matrix.

    Authorization lives here rather than in the router because it is a
    business rule: it has to hold for every caller, it has to be testable
    without the ASGI stack, and "EDITOR, but only its own items" needs the
    item loaded — by which point you are already doing the use case.
    `get_current_user` answers *who* the caller is; this answers *what they
    may do*.
    """

    def __init__(self, item_repository: ItemRepository) -> None:
        self._item_repository = item_repository

    async def search(
        self, query: str | None, category: str | None, offset: int, limit: int
    ) -> tuple[list[Item], int]:
        """Return a page of items. Every authenticated role may read the catalogue."""
        return await self._item_repository.search(query, category, offset, limit)

    async def get(self, item_id: int) -> Item:
        """Return one item.

        Raises:
            ItemNotFoundError: if no item has that id.
        """
        return await self._get_or_raise(item_id)

    async def create(self, item: Item, current_user: User) -> Item:
        """Create an item owned by `current_user`.

        Raises:
            ForbiddenError: if the user is below EDITOR.
            DuplicateSlugError: if the slug is already taken.
        """
        self._ensure_at_least(current_user, UserRole.EDITOR)
        await self._ensure_slug_is_free(item.slug)
        if current_user.id is None:
            raise ValueError("The authenticated user must be persisted")
        item.owner_id = current_user.id
        item.version = 1
        return await self._item_repository.save(item)

    async def update(self, item_id: int, changes: Item, current_user: User) -> Item:
        """Apply `changes` to an existing item.

        `changes.version` is the version the client read. A mismatch surfaces as
        SQLAlchemy's `StaleDataError`, translated to HTTP 409 by the error handler.

        Raises:
            ItemNotFoundError: if no item has that id.
            ForbiddenError: if the user is neither an ADMIN nor the item's owner.
            DuplicateSlugError: if the new slug belongs to a different item.
        """
        existing = await self._get_or_raise(item_id)
        self._ensure_may_write(existing, current_user)
        if changes.slug != existing.slug:
            await self._ensure_slug_is_free(changes.slug)

        existing.name = changes.name
        existing.slug = changes.slug
        existing.description = changes.description
        existing.category = changes.category
        existing.tag_names = changes.tag_names
        existing.version = changes.version
        return await self._item_repository.save(existing)

    async def delete(self, item_id: int, current_user: User) -> None:
        """Delete an item. Deleting is an ADMIN privilege across the whole system.

        The existence check runs before the role check, so an ADMIN and a
        VIEWER both get a 404 for an item that does not exist. The order is
        the same in every method here; mixing them produces an API whose
        error code leaks whether a row exists.

        Raises:
            ItemNotFoundError: if no item has that id.
            ForbiddenError: if the user is not an ADMIN.
        """
        await self._get_or_raise(item_id)
        self._ensure_at_least(current_user, UserRole.ADMIN)
        await self._item_repository.delete(item_id)

    async def _get_or_raise(self, item_id: int) -> Item:
        item = await self._item_repository.find_by_id(item_id)
        if item is None:
            raise ItemNotFoundError(f"Item {item_id} not found")
        return item

    async def _ensure_slug_is_free(self, slug: str) -> None:
        if await self._item_repository.find_by_slug(slug) is not None:
            raise DuplicateSlugError(f"Slug already in use: {slug}")

    @staticmethod
    def _ensure_at_least(user: User, minimum: UserRole) -> None:
        if not has_role(user, minimum):
            raise ForbiddenError("You do not have permission to perform this action")

    @staticmethod
    def _ensure_may_write(item: Item, user: User) -> None:
        """ADMIN edits anything; EDITOR edits only what it owns; VIEWER edits nothing."""
        if has_role(user, UserRole.ADMIN):
            return
        if has_role(user, UserRole.EDITOR) and item.owner_id == user.id:
            return
        raise ForbiddenError("You do not have permission to perform this action")
