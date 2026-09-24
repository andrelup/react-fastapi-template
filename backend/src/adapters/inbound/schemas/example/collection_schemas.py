"""Per-operation API schemas for the catalogue's collections.

One class per operation, never a single `CollectionSchema` with optional
fields everywhere — see `item_schemas.py` for why.
"""

from pydantic import BaseModel, ConfigDict, Field


class CollectionCreate(BaseModel):
    """Payload for creating a collection. ADMIN only."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Guias de incorporacion",
                "description": "Documentos para dar la bienvenida al equipo.",
            }
        }
    )

    name: str = Field(min_length=1, max_length=200, description="Display name of the collection.")
    description: str | None = Field(default=None, description="Free-text description.")


class CollectionUpdate(CollectionCreate):
    """Payload for updating a collection. `version` is mandatory — it is the optimistic lock."""

    version: int = Field(
        ge=1, description="Version the client last read. A stale value returns 409."
    )


class CollectionResponse(BaseModel):
    """Public representation of a collection.

    No `from_attributes=True`, to stay consistent with `ItemResponse`: the
    router builds it field by field instead.
    """

    id: int
    name: str
    description: str | None
    version: int = Field(description="Round-trip this on update to keep the lock honest.")


class PaginatedCollections(BaseModel):
    """One page of collections, matching the SPA's `PaginatedResponse<T>`."""

    items: list[CollectionResponse]
    total: int
    page: int
    page_size: int
