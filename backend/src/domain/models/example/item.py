"""Item domain model — the publishable resource of the sample catalogue.

Plain dataclass, independent of any persistence or web framework.
"""

from dataclasses import dataclass, field

from src.domain.models.example.collection import CollectionRef


@dataclass
class Item:
    """An item in the catalogue, owned by the editor who created it.

    Not `frozen=True`, unlike `User`: the update use case rolls `version`
    forward before handing the item to the repository, so it has to be
    mutable. `id` is `None` until the item is persisted — that is what the
    repository reads to decide between an INSERT and an UPDATE.
    """

    name: str
    slug: str
    owner_id: int
    description: str | None = None
    category: str | None = None
    # Tags are a detail of how an item is labelled, not an aggregate of its
    # own from the item's point of view: the repository resolves these names
    # to `TagORM` rows.
    tag_names: list[str] = field(default_factory=list)
    # Collections, unlike tags, are addressed by id — the client resolves an
    # existing collection through `CollectionRepository`, never creates one
    # implicitly by naming it. See `ItemService.set_collections`.
    collections: list[CollectionRef] = field(default_factory=list)
    id: int | None = None
    version: int = 1
