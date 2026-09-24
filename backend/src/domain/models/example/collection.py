"""Collection domain model — an editorial grouping in the sample catalogue.

Plain dataclasses, independent of any persistence or web framework.
"""

from dataclasses import dataclass


@dataclass
class Collection:
    """An editorial grouping of items.

    Unlike `Item`, a collection has no owner: it belongs to the catalogue
    itself, and who may write it is decided by role alone (see
    `CollectionService`). Not `frozen=True`, like `Item`: the update use case
    rolls `version` forward before handing the collection to the repository,
    so it has to be mutable. `id` is `None` until persisted — that is what
    the repository reads to decide between an INSERT and an UPDATE.
    """

    name: str
    description: str | None = None
    id: int | None = None
    version: int = 1


@dataclass(frozen=True)
class CollectionRef:
    """Lightweight reference to a collection, carried by an `Item`.

    Just enough to render a link back to the collection without loading the
    whole aggregate — mirrors why `Item.tag_names` is `list[str]` rather than
    `list[Tag]`, except a collection needs its id too since it is addressed
    by id, not by a natural key.
    """

    id: int
    name: str
