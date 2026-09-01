"""Pydantic request/response schemas for the favourite lists API."""

from pydantic import BaseModel, ConfigDict, Field


class FavouriteListCreate(BaseModel):
    """Payload to create a favourite list. `owner_id` is derived from the caller's token."""

    model_config = ConfigDict(json_schema_extra={"example": {"name": "Summer 2026"}})

    name: str = Field(min_length=1, max_length=120)


class FavouriteListUpdate(BaseModel):
    """Payload to rename an existing favourite list.

    `version` is mandatory: it is the optimistic-locking version the client
    read the list at, and it is asserted against the stored row. Sending a
    version that is no longer current means someone else modified the list in
    the meantime, and the request is rejected with 409 instead of silently
    overwriting that change.
    """

    model_config = ConfigDict(
        json_schema_extra={"example": {"name": "Summer 2026 reading list", "version": 1}}
    )

    name: str = Field(min_length=1, max_length=120)
    version: int = Field(
        ge=1,
        description=(
            "Version this list was read at, as returned by a previous GET or PUT. "
            "The rename is rejected with 409 if the list has been modified since."
        ),
        examples=[1],
    )


class FavouriteListItemCreate(BaseModel):
    """Payload to add a book to a favourite list."""

    model_config = ConfigDict(json_schema_extra={"example": {"book_id": 1}})

    book_id: int = Field(gt=0, description="Id of the catalog book to add to the list.")


class FavouriteListResponse(BaseModel):
    """Favourite list representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int = Field(description="Id of the customer who owns this list.")
    name: str
    book_ids: list[int] = Field(description="Ids of the books collected in this list.")
    version: int = Field(
        description=(
            "Current optimistic-locking version of this list. Send it back in "
            "the next rename to prove the change is based on this state."
        ),
        examples=[1],
    )


class FavouriteListCollectionResponse(BaseModel):
    """A collection of a customer's favourite lists."""

    items: list[FavouriteListResponse]
    total: int
