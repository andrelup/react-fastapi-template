"""Persistence ports for the sample catalogue."""

from typing import Protocol

from src.domain.models.example.collection import Collection
from src.domain.models.example.item import Item


class ItemRepository(Protocol):
    """Persistence contract for `Item` aggregates."""

    async def find_by_id(self, item_id: int) -> Item | None:
        """Return the item with the given id, or None if it does not exist."""
        ...

    async def find_by_slug(self, slug: str) -> Item | None:
        """Return the item with the given slug, or None if it does not exist."""
        ...

    async def search(
        self, query: str | None, category: str | None, offset: int, limit: int
    ) -> tuple[list[Item], int]:
        """Return a page of matching items and the total number of matches.

        The total travels back with the page because the caller needs it to
        build the paginated response, and a second call would count a table
        that may have moved underneath.
        """
        ...

    async def save(self, item: Item) -> Item:
        """Persist an item, inserting it if `item.id` is None or updating it otherwise."""
        ...

    async def delete(self, item_id: int) -> None:
        """Remove the item with the given id. A missing row is a no-op."""
        ...


class CollectionRepository(Protocol):
    """Persistence contract for `Collection` aggregates."""

    async def find_by_id(self, collection_id: int) -> Collection | None:
        """Return the collection with the given id, or None if it does not exist."""
        ...

    async def find_all(self, page: int, page_size: int) -> tuple[list[Collection], int]:
        """Return a page of collections and the total number of collections.

        `page` is 1-indexed, matching the router's query parameter. The total
        travels back with the page for the same reason it does on
        `ItemRepository.search`.
        """
        ...

    async def find_by_ids(self, ids: list[int]) -> list[Collection]:
        """Return the collections whose id is in `ids`. Unknown ids are silently skipped.

        `ItemService.set_collections` is the caller, and it is the one that
        decides an id missing from the result means `CollectionNotFoundError`
        — the port itself does not raise.
        """
        ...

    async def find_by_name(self, name: str) -> Collection | None:
        """Return the collection with the given name, or None if it does not exist."""
        ...

    async def save(self, collection: Collection) -> Collection:
        """Persist a collection, inserting it if `collection.id` is None, updating it otherwise."""
        ...

    async def delete(self, collection_id: int) -> None:
        """Remove the collection with the given id. A missing row is a no-op."""
        ...
