"""Persistence ports for the sample catalogue."""

from typing import Protocol

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
