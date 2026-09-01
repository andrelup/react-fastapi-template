"""Domain model representing a customer's named list of favourite books."""

from dataclasses import dataclass, field


@dataclass
class FavouriteList:
    """A named list of favourite books owned by a customer.

    An aggregate: the list owns its books, referenced by id. British
    spelling (`favourite`) is used consistently across the feature.

    Attributes:
        owner_id: Identifier of the customer who owns this list.
        name: Human-readable list name (e.g. "Summer 2026"), unique per owner.
        book_ids: Ids of the books collected in this list, without duplicates.
        id: Unique identifier. `None` for a list not yet persisted.
        version: Optimistic-locking version the caller loaded this list at.
            A `save()` asserts this value against the row's current version,
            so a write based on stale data fails instead of overwriting a
            concurrent change. Defaults to 1 for a list not yet persisted.
    """

    owner_id: int
    name: str
    book_ids: list[int] = field(default_factory=list)
    id: int | None = None
    version: int = 1
