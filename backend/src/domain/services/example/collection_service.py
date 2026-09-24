"""Collection use cases: listing, creation, update and deletion, with authorization.

Unlike `Item`, a `Collection` has no owner — it belongs to the catalogue
itself, not to a user. Authorization is therefore role alone: every
authenticated role may read, and only ADMIN may write. There is no
`_ensure_may_write` analogue here, because there is no ownership to check.

Which collections an *item* belongs to is a different question, resolved by
`ItemService.set_collections` — an EDITOR may put its own items into
existing collections without being able to create or rename them.
"""

from src.domain.exceptions import (
    CollectionNotFoundError,
    DuplicateCollectionNameError,
    ForbiddenError,
)
from src.domain.models.example.collection import Collection
from src.domain.models.user import User, UserRole, has_role
from src.domain.ports.example.repositories import CollectionRepository


class CollectionService:
    """Coordinates the collection use cases and enforces the ADMIN-only write rule."""

    def __init__(self, collection_repository: CollectionRepository) -> None:
        self._collection_repository = collection_repository

    async def list_collections(self, page: int, page_size: int) -> tuple[list[Collection], int]:
        """Return a page of collections. Every authenticated role may read the catalogue."""
        return await self._collection_repository.find_all(page, page_size)

    async def get_collection(self, collection_id: int) -> Collection:
        """Return one collection.

        Raises:
            CollectionNotFoundError: if no collection has that id.
        """
        return await self._get_or_raise(collection_id)

    async def create(self, collection: Collection, current_user: User) -> Collection:
        """Create a collection. Governing the catalogue of collections is an ADMIN privilege.

        Raises:
            ForbiddenError: if the user is not an ADMIN.
            DuplicateCollectionNameError: if the name is already taken.
        """
        self._ensure_at_least(current_user, UserRole.ADMIN)
        await self._ensure_name_is_free(collection.name)
        collection.version = 1
        return await self._collection_repository.save(collection)

    async def update(
        self, collection_id: int, changes: Collection, current_user: User
    ) -> Collection:
        """Apply `changes` to an existing collection.

        `changes.version` is the version the client last read. A mismatch
        surfaces as SQLAlchemy's `StaleDataError`, translated to HTTP 409 by
        the error handler.

        Raises:
            CollectionNotFoundError: if no collection has that id.
            ForbiddenError: if the user is not an ADMIN.
            DuplicateCollectionNameError: if the new name belongs to another collection.
        """
        existing = await self._get_or_raise(collection_id)
        self._ensure_at_least(current_user, UserRole.ADMIN)
        if changes.name != existing.name:
            await self._ensure_name_is_free(changes.name)

        existing.name = changes.name
        existing.description = changes.description
        existing.version = changes.version
        return await self._collection_repository.save(existing)

    async def delete(self, collection_id: int, current_user: User) -> None:
        """Delete a collection. Deleting is an ADMIN privilege, like create and update.

        The existence check runs before the role check, exactly as
        `ItemService.delete` does, so the error code never leaks whether the
        row exists.

        Raises:
            CollectionNotFoundError: if no collection has that id.
            ForbiddenError: if the user is not an ADMIN.
        """
        await self._get_or_raise(collection_id)
        self._ensure_at_least(current_user, UserRole.ADMIN)
        await self._collection_repository.delete(collection_id)

    async def _get_or_raise(self, collection_id: int) -> Collection:
        collection = await self._collection_repository.find_by_id(collection_id)
        if collection is None:
            raise CollectionNotFoundError(f"Collection {collection_id} not found")
        return collection

    async def _ensure_name_is_free(self, name: str) -> None:
        if await self._collection_repository.find_by_name(name) is not None:
            raise DuplicateCollectionNameError(f"Collection name already in use: {name}")

    @staticmethod
    def _ensure_at_least(user: User, minimum: UserRole) -> None:
        if not has_role(user, minimum):
            raise ForbiddenError("You do not have permission to perform this action")
