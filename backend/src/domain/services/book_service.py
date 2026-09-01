"""Book catalog use cases: create, update, delete, list, get and search."""

from dataclasses import replace

from src.domain.exceptions import BookNotFoundError, BookValidationError, ForbiddenError
from src.domain.models.book import Book
from src.domain.models.user import User, UserRole
from src.domain.ports.repositories import BookRepository


class BookService:
    """Business rules for browsing and managing the book catalog.

    Read operations (`get`, `list_books`, `search`) are available to any
    authenticated role. Write operations (`create`, `update`, `delete`) are
    restricted to users with the "seller" role, and further restricted to
    the seller who owns the book for `update` and `delete`.
    """

    def __init__(self, book_repository: BookRepository) -> None:
        self._book_repository = book_repository

    async def create(self, seller: User, book: Book) -> Book:
        """Create a new book listing, always owned by `seller`.

        Raises:
            ForbiddenError: if `seller` does not have the "seller" role.
            BookValidationError: if `book` violates a business rule.
        """
        seller_id = self._ensure_seller(seller)
        candidate = replace(book, id=None, seller_id=seller_id)
        self._validate(candidate)
        return await self._book_repository.save(candidate)

    async def update(self, seller: User, book_id: int, changes: Book) -> Book:
        """Update an existing book. Only its owning seller may update it.

        `changes.version` is the version the *client* read the book at and is
        deliberately preserved: the repository turns it into the UPDATE's
        `WHERE version = ...`, so a write based on a stale read raises
        `StaleDataError` (409) instead of clobbering a concurrent change.
        Overwriting it with `existing.version` would make the check pass
        always (`existing` was read microseconds ago) and silently reintroduce
        lost updates, and comparing the two here instead would be a TOCTOU
        race — the assertion must travel inside the UPDATE.

        Raises:
            ForbiddenError: if `seller` is not a seller, or not the book's owner.
            BookNotFoundError: if no book exists with `book_id`.
            BookValidationError: if `changes` violates a business rule.
        """
        self._ensure_seller(seller)
        existing = await self._get_or_raise(book_id)
        self._ensure_owner(seller, existing)
        candidate = replace(changes, id=existing.id, seller_id=existing.seller_id)
        self._validate(candidate)
        return await self._book_repository.save(candidate)

    async def delete(self, seller: User, book_id: int) -> None:
        """Delete a book. Only its owning seller may delete it.

        Raises:
            ForbiddenError: if `seller` is not a seller, or not the book's owner.
            BookNotFoundError: if no book exists with `book_id`.
        """
        self._ensure_seller(seller)
        existing = await self._get_or_raise(book_id)
        self._ensure_owner(seller, existing)
        await self._book_repository.delete(book_id)

    async def get(self, book_id: int) -> Book:
        """Return a single book by id.

        Raises:
            BookNotFoundError: if no book exists with `book_id`.
        """
        return await self._get_or_raise(book_id)

    async def list_books(self, skip: int, limit: int) -> tuple[list[Book], int]:
        """Return a page of books plus the total count, for pagination."""
        books = await self._book_repository.find_all(skip=skip, limit=limit)
        total = await self._book_repository.count()
        return books, total

    async def search(self, query: str, skip: int, limit: int) -> tuple[list[Book], int]:
        """Return a page of books matching `query`, plus the total match count."""
        books = await self._book_repository.search(query=query, skip=skip, limit=limit)
        total = await self._book_repository.count_search(query=query)
        return books, total

    async def _get_or_raise(self, book_id: int) -> Book:
        book = await self._book_repository.find_by_id(book_id)
        if book is None:
            raise BookNotFoundError(f"Book {book_id} not found")
        return book

    @staticmethod
    def _ensure_seller(user: User) -> int:
        """Check `user` has the "seller" role and return their (persisted) id."""
        if user.role != UserRole.SELLER:
            raise ForbiddenError("Only sellers can manage book listings")
        if user.id is None:
            # Defensive: an authenticated seller is always a persisted user.
            raise ForbiddenError("Only sellers can manage book listings")
        return user.id

    @staticmethod
    def _ensure_owner(user: User, book: Book) -> None:
        if book.seller_id != user.id:
            raise ForbiddenError("Sellers can only manage their own books")

    @staticmethod
    def _validate(book: Book) -> None:
        if not book.title.strip():
            raise BookValidationError("Title cannot be empty")
        if not book.isbn.strip():
            raise BookValidationError("ISBN cannot be empty")
        if book.price <= 0:
            raise BookValidationError("Price must be greater than zero")
        if book.stock < 0:
            raise BookValidationError("Stock cannot be negative")
