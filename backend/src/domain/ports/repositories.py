"""Persistence ports (Protocol interfaces) exposed by the domain."""

from typing import Protocol

from src.domain.models.book import Book
from src.domain.models.favourite import FavouriteList
from src.domain.models.user import User


class UserRepository(Protocol):
    """Persistence contract for `User` aggregates."""

    async def find_by_id(self, user_id: int) -> User | None:
        """Return the user with the given id, or None if it does not exist."""
        ...

    async def find_by_email(self, email: str) -> User | None:
        """Return the user with the given email, or None if it does not exist."""
        ...

    async def save(self, user: User) -> User:
        """Persist a user, inserting it if `user.id` is None or updating it otherwise."""
        ...


class BookRepository(Protocol):
    """Persistence port for `Book` aggregates.

    Implemented by adapters in `adapters/outbound/persistence`.
    """

    async def find_by_id(self, book_id: int) -> Book | None:
        """Return the book with the given id, or `None` if it does not exist."""
        ...

    async def find_all(self, skip: int, limit: int) -> list[Book]:
        """Return a page of books ordered by id."""
        ...

    async def count(self) -> int:
        """Return the total number of books in the catalog."""
        ...

    async def search(self, query: str, skip: int, limit: int) -> list[Book]:
        """Return a page of books whose title, author or category match `query`."""
        ...

    async def count_search(self, query: str) -> int:
        """Return the total number of books matching `query`."""
        ...

    async def save(self, book: Book) -> Book:
        """Persist `book`, creating it if `book.id` is `None`, updating otherwise."""
        ...

    async def delete(self, book_id: int) -> None:
        """Delete the book with the given id, if it exists."""
        ...


class FavouriteListRepository(Protocol):
    """Persistence port for `FavouriteList` aggregates.

    Implemented by adapters in `adapters/outbound/persistence`.
    """

    async def find_by_id(self, list_id: int) -> FavouriteList | None:
        """Return the favourite list with the given id, or `None` if absent."""
        ...

    async def find_all_by_owner(self, owner_id: int) -> list[FavouriteList]:
        """Return every favourite list owned by `owner_id`, ordered by id."""
        ...

    async def find_by_owner_and_name(self, owner_id: int, name: str) -> FavouriteList | None:
        """Return the owner's list with the given name, or `None` if absent."""
        ...

    async def save(self, favourite_list: FavouriteList) -> FavouriteList:
        """Persist `favourite_list`, creating it if its id is `None`, updating otherwise."""
        ...

    async def delete(self, list_id: int) -> None:
        """Delete the favourite list with the given id, if it exists."""
        ...
