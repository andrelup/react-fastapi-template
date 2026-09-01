"""Test data factories, shared across unit, integration and API tests."""

from src.domain.models.book import Book
from src.domain.models.favourite import FavouriteList

_DEFAULT_BOOK_FIELDS: dict[str, object] = {
    "title": "Clean Architecture",
    "author": "Robert C. Martin",
    "isbn": "978-0134494166",
    "price": 39.99,
    "stock": 5,
    "seller_id": 1,
    "description": "A craftsman's guide to software structure.",
    "category": "Software Engineering",
    # Optimistic-locking version a caller loaded the entity at. Override it to
    # simulate a stale write (a version other than the stored one).
    "version": 1,
}

_DEFAULT_FAVOURITE_LIST_FIELDS: dict[str, object] = {
    "owner_id": 3,
    "name": "Summer 2026",
    "version": 1,
}


def make_book(**overrides: object) -> Book:
    """Build a valid `Book` for tests, overriding only the fields under test."""
    fields = {**_DEFAULT_BOOK_FIELDS, **overrides}
    return Book(**fields)  # type: ignore[arg-type]


def make_favourite_list(**overrides: object) -> FavouriteList:
    """Build a valid `FavouriteList` for tests, overriding only the fields under test."""
    fields = {**_DEFAULT_FAVOURITE_LIST_FIELDS, **overrides}
    return FavouriteList(**fields)  # type: ignore[arg-type]
