"""Per-operation API schemas for the catalogue's tags.

One class per operation, matching `item_schemas.py`: a create payload never
carries an id, and the response is what a client round-trips.
"""

from pydantic import BaseModel, ConfigDict, Field


class TagEnsureExists(BaseModel):
    """Payload for `POST /tags`. Carries only the name — no id, per §3 of the walkthrough."""

    model_config = ConfigDict(json_schema_extra={"example": {"name": "onboarding"}})

    name: str = Field(min_length=1, max_length=50, description="Tag name.")


class TagResponse(BaseModel):
    """Public representation of a tag."""

    id: int
    name: str


class TagListResponse(BaseModel):
    """The tags matching a search.

    No `total` and no `page`, unlike `ItemPageResponse`: the consumer is a
    dropdown that never goes past the first page of at most 50 results, and a
    `total` nobody reads would be dead contract to maintain.
    """

    tags: list[TagResponse]
