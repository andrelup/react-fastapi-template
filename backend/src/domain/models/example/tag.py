"""Tag domain model — a label in the catalogue's shared vocabulary.

Plain dataclass, independent of any persistence or web framework. `Item.tag_names`
keeps talking about names, never about this model or its id: from the item's point
of view a tag is a string, and it is `TagRepository`/`TagService` that let the rest
of the system address the same rows by id.
"""

from dataclasses import dataclass


@dataclass
class Tag:
    """A tag in the catalogue, resolved by its unique `name`.

    Not `frozen=True`: `id` is `None` until the tag is persisted, exactly like
    `Item`, and mutating it in place after `save()` is how the repository
    hands the caller back the assigned id.
    """

    name: str
    id: int | None = None
