"""Pydantic request/response schemas for the books API."""

from pydantic import BaseModel, ConfigDict, Field


class BookCreate(BaseModel):
    """Payload to create a new book. `seller_id` is derived from the caller's token."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "The Pragmatic Programmer",
                "author": "David Thomas, Andrew Hunt",
                "isbn": "978-0135957059",
                "price": 39.99,
                "stock": 12,
                "description": "A guide to becoming a better developer.",
                "category": "Software Engineering",
            }
        }
    )

    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    isbn: str = Field(min_length=1, max_length=20, examples=["978-0135957059"])
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    description: str = ""
    category: str = Field(min_length=1, max_length=100)


class BookUpdate(BaseModel):
    """Payload to replace an existing book's editable fields.

    `version` is mandatory: it is the optimistic-locking version the client
    read the book at, and it is asserted against the stored row. Sending a
    version that is no longer current means someone else updated the book in
    the meantime, and the request is rejected with 409 instead of silently
    overwriting that change.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "The Pragmatic Programmer",
                "author": "David Thomas, Andrew Hunt",
                "isbn": "978-0135957059",
                "price": 34.99,
                "stock": 8,
                "description": "A guide to becoming a better developer.",
                "category": "Software Engineering",
                "version": 1,
            }
        }
    )

    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    isbn: str = Field(min_length=1, max_length=20, examples=["978-0135957059"])
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    description: str = ""
    category: str = Field(min_length=1, max_length=100)
    version: int = Field(
        ge=1,
        description=(
            "Version this book was read at, as returned by a previous GET or PUT. "
            "The update is rejected with 409 if the book has been modified since."
        ),
        examples=[1],
    )


class BookResponse(BaseModel):
    """Book representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author: str
    isbn: str
    price: float
    stock: int
    seller_id: int = Field(description="Id of the seller who owns this listing.")
    description: str
    category: str
    version: int = Field(
        description=(
            "Current optimistic-locking version of this book. Send it back in "
            "the next update to prove the change is based on this state."
        ),
        examples=[1],
    )


class BookListResponse(BaseModel):
    """A paginated page of books."""

    items: list[BookResponse]
    total: int
    skip: int = Field(description="Number of items skipped before this page.")
    limit: int = Field(description="Maximum number of items requested for this page.")
