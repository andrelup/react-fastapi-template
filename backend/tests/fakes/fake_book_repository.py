"""In-memory fake implementing the `BookRepository` port, for fast tests.

Used by unit tests (domain service, mocked ports — no DB/I/O) and by API
tests (dependency-overriding the outbound port so router tests exercise
wiring, validation and error translation without a real database).

The fake models optimistic locking exactly like the SQLAlchemy repository:
an update asserts the caller's `version` against the stored one and raises
`StaleDataError` (the same exception `version_id_col` raises, and the one the
error_handler maps to 409) when they differ. Without this, a `save()` that
just overwrites the dict would let a stale write pass silently and every
locking test would be green while asserting nothing.
"""

from dataclasses import replace

from sqlalchemy.orm.exc import StaleDataError
from src.domain.models.book import Book


class FakeBookRepository:
    """An in-memory `BookRepository` backed by a plain dict, for tests."""

    def __init__(self, books: list[Book] | None = None) -> None:
        self._books: dict[int, Book] = {}
        self._next_id = 1
        for book in books or []:
            self._add(book)

    def _add(self, book: Book) -> Book:
        book_id = book.id if book.id is not None else self._next_id
        stored = replace(book, id=book_id)
        self._books[book_id] = stored
        self._next_id = max(self._next_id, book_id + 1)
        return stored

    async def find_by_id(self, book_id: int) -> Book | None:
        return self._books.get(book_id)

    async def find_all(self, skip: int, limit: int) -> list[Book]:
        ordered = sorted(self._books.values(), key=lambda book: book.id or 0)
        return ordered[skip : skip + limit]

    async def count(self) -> int:
        return len(self._books)

    async def search(self, query: str, skip: int, limit: int) -> list[Book]:
        needle = query.lower()
        matches = [
            book
            for book in sorted(self._books.values(), key=lambda book: book.id or 0)
            if needle in book.title.lower()
            or needle in book.author.lower()
            or needle in book.category.lower()
        ]
        return matches[skip : skip + limit]

    async def count_search(self, query: str) -> int:
        return len(await self.search(query, skip=0, limit=len(self._books) or 1))

    async def save(self, book: Book) -> Book:
        """Insert a new book, or update an existing one asserting its version.

        Mirrors `version_id_col`: the update only applies when `book.version`
        still matches the stored row (as if it were in the UPDATE's WHERE
        clause), and bumps the version. An insert asserts nothing and is born
        at version 1.
        """
        existing = self._books.get(book.id) if book.id is not None else None
        if existing is not None:
            if existing.version != book.version:
                raise StaleDataError(f"Book {book.id} was modified by another request")
            book = replace(book, version=existing.version + 1)
        return self._add(book)

    async def delete(self, book_id: int) -> None:
        self._books.pop(book_id, None)
