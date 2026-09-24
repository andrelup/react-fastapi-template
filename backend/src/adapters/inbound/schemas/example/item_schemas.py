"""Per-operation API schemas for the catalogue's items.

One class per operation, never a single `ItemSchema` with optional fields
everywhere: that shape is what makes `version` optional on update, and with it
the optimistic lock opt-in.
"""

from pydantic import BaseModel, ConfigDict, Field


class ItemCreate(BaseModel):
    """Payload for creating an item. `owner_id` is derived from the JWT, never sent."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Manual de bienvenida",
                "slug": "manual-de-bienvenida",
                "description": "Guía de incorporación para el equipo.",
                "category": "documentacion",
                "tags": ["onboarding", "interno"],
            }
        }
    )

    name: str = Field(min_length=1, max_length=200, description="Display name of the item.")
    slug: str = Field(
        min_length=1,
        max_length=200,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-safe unique identifier, lowercase and hyphen-separated.",
    )
    description: str | None = Field(default=None, description="Free-text description.")
    category: str | None = Field(
        default=None, max_length=50, description="Category used to filter the catalogue."
    )
    tags: list[str] = Field(default_factory=list, description="Tag names, created if new.")


class ItemUpdate(ItemCreate):
    """Payload for updating an item. `version` is mandatory — it is the optimistic lock."""

    version: int = Field(
        ge=1, description="Version the client last read. A stale value returns 409."
    )


class ItemResponse(BaseModel):
    """Public representation of an item.

    No `from_attributes=True`: `tags` does not line up with the domain model's
    `tag_names`, so `model_validate(item)` would fail. The router builds it
    field by field instead, in `_to_response`.
    """

    id: int
    name: str
    slug: str
    description: str | None
    category: str | None
    tags: list[str]
    owner_id: int
    version: int = Field(description="Round-trip this on update to keep the lock honest.")


class ItemPageResponse(BaseModel):
    """One page of items, matching the SPA's `PaginatedResponse<T>`.

    `page_size` is snake_case like every other field on the wire; mapping it to
    `pageSize` is the SPA's job, not the API's.

    Deliberately still built from `ItemResponse`, without collections: the
    list endpoints (`GET /items`, `GET /items/search`) keep the lighter
    shape so existing frontend mocks never break. Only `GET /items/{item_id}`
    returns `ItemDetailResponse`.
    """

    items: list[ItemResponse]
    total: int
    page: int
    page_size: int


class CollectionRefResponse(BaseModel):
    """Lightweight reference to a collection an item belongs to."""

    id: int
    name: str


class ItemDetailResponse(ItemResponse):
    """`ItemResponse` plus the collections the item belongs to.

    Only `GET /items/{item_id}` returns this shape; the paginated list
    endpoints keep returning plain `ItemResponse`.
    """

    collections: list[CollectionRefResponse]


class ItemCollectionsUpdate(BaseModel):
    """Payload for `PUT /items/{item_id}/collections`. `version` is mandatory.

    Membership takes part in the item's own optimistic lock — a stale
    version returns 409, exactly like `ItemUpdate`.
    """

    collection_ids: list[int] = Field(default_factory=list, description="Collections to belong to.")
    version: int = Field(
        ge=1, description="Version the client last read. A stale value returns 409."
    )
