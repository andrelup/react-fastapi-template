"""In-memory `CollectionRepository`, shared by `test_collection_service.py` and
`test_item_service.py` (the latter because `ItemService.set_collections` resolves
collection ids through this port too).

Honours the same invariants `SqlAlchemyCollectionRepository` will: every method
hands out copies rather than stored instances, and `save` replicates the
optimistic lock PostgreSQL enforces for real, raising `StaleDataError` on a
version mismatch. See `FakeItemRepository` in `test_item_service.py` for why
that aliasing is load-bearing rather than cosmetic.
"""

from dataclasses import replace

from sqlalchemy.orm.exc import StaleDataError
from src.domain.models.example.collection import Collection


def _copy(collection: Collection) -> Collection:
    """Return an independent copy of `collection`."""
    return replace(collection)


class FakeCollectionRepository:
    """In-memory `CollectionRepository`, including the version check PostgreSQL does for real."""

    def __init__(self, collections: list[Collection] | None = None) -> None:
        self._collections = {
            collection.id: _copy(collection)
            for collection in collections or []
            if collection.id is not None
        }
        self._next_id = max(self._collections, default=0) + 1

    async def find_by_id(self, collection_id: int) -> Collection | None:
        stored = self._collections.get(collection_id)
        return _copy(stored) if stored is not None else None

    async def find_all(self, page: int, page_size: int) -> tuple[list[Collection], int]:
        offset = (page - 1) * page_size
        ordered = sorted(self._collections.values(), key=lambda collection: collection.name)
        return [_copy(collection) for collection in ordered[offset : offset + page_size]], len(
            ordered
        )

    async def find_by_ids(self, ids: list[int]) -> list[Collection]:
        return [_copy(self._collections[i]) for i in ids if i in self._collections]

    async def find_by_name(self, name: str) -> Collection | None:
        stored = next((c for c in self._collections.values() if c.name == name), None)
        return _copy(stored) if stored is not None else None

    async def save(self, collection: Collection) -> Collection:
        if collection.id is None:
            stored = replace(_copy(collection), id=self._next_id)
            self._next_id += 1
        else:
            current = self._collections[collection.id]
            if current.version != collection.version:
                raise StaleDataError(
                    "UPDATE statement on table 'collections' expected to update 1 row"
                )
            stored = replace(_copy(collection), version=collection.version + 1)
        if stored.id is None:
            raise ValueError("A stored collection always has an id")
        self._collections[stored.id] = stored
        return _copy(stored)

    async def delete(self, collection_id: int) -> None:
        self._collections.pop(collection_id, None)
