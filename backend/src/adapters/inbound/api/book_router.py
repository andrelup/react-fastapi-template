"""Book catalog endpoints: CRUD with pagination and role-based authorization.

Authorization rules (enforced by `BookService`, translated to HTTP by the
error_handler middleware):
    - Any authenticated user (customer or seller) may list, search and view
      book details.
    - Only sellers may create books; a created book is always owned by the
      authenticated seller.
    - Only the owning seller may update or delete a book (403 otherwise).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.adapters.inbound.middleware.auth import get_current_user
from src.adapters.inbound.schemas.book_schemas import (
    BookCreate,
    BookListResponse,
    BookResponse,
    BookUpdate,
)
from src.adapters.inbound.schemas.common import ApiResponse, error_responses
from src.config.container import get_book_service
from src.domain.models.book import Book
from src.domain.models.user import User
from src.domain.services.book_service import BookService

router = APIRouter(prefix="/books", tags=["books"])

# `Book.seller_id` is a plain `int`. `BookService.create`/`update` always
# re-derive the real seller id from the authenticated `User` (and reject the
# request if that user has no persisted id), so this is only a structurally
# valid placeholder for the field, never trusted as-is.
_UNVALIDATED_SELLER_ID_PLACEHOLDER = 0


def _to_response(book: Book) -> BookResponse:
    if book.id is None:
        raise ValueError("Cannot build a response for a book without an id")
    return BookResponse(
        id=book.id,
        title=book.title,
        author=book.author,
        isbn=book.isbn,
        price=book.price,
        stock=book.stock,
        seller_id=book.seller_id,
        description=book.description,
        category=book.category,
        version=book.version,
    )


def _to_list_response(books: list[Book], total: int, skip: int, limit: int) -> BookListResponse:
    return BookListResponse(
        items=[_to_response(book) for book in books],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/search",
    response_model=ApiResponse[BookListResponse],
    summary="Search books",
    response_description="A page of books matching the search term.",
    responses=error_responses(401),
)
async def search_books(
    book_service: Annotated[BookService, Depends(get_book_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str, Query(min_length=1, description="Search term")],
    skip: Annotated[int, Query(ge=0, description="Number of items to skip before this page.")] = 0,
    limit: Annotated[
        int, Query(ge=1, le=100, description="Maximum number of items to return.")
    ] = 20,
) -> ApiResponse[BookListResponse]:
    """Search books by title, author or category. Available to any role."""
    books, total = await book_service.search(query=q, skip=skip, limit=limit)
    data = _to_list_response(books, total, skip, limit)
    return ApiResponse(success=True, data=data, error=None)


@router.get(
    "",
    response_model=ApiResponse[BookListResponse],
    summary="List books",
    response_description="A page of books from the catalog.",
    responses=error_responses(401),
)
async def list_books(
    book_service: Annotated[BookService, Depends(get_book_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
    skip: Annotated[int, Query(ge=0, description="Number of items to skip before this page.")] = 0,
    limit: Annotated[
        int, Query(ge=1, le=100, description="Maximum number of items to return.")
    ] = 20,
) -> ApiResponse[BookListResponse]:
    """List books, paginated. Available to any role."""
    books, total = await book_service.list_books(skip=skip, limit=limit)
    data = _to_list_response(books, total, skip, limit)
    return ApiResponse(success=True, data=data, error=None)


@router.get(
    "/{book_id}",
    response_model=ApiResponse[BookResponse],
    summary="Get a book by id",
    response_description="The requested book.",
    responses=error_responses(401, 404),
)
async def get_book(
    book_id: int,
    book_service: Annotated[BookService, Depends(get_book_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[BookResponse]:
    """Get a single book by id. Available to any role."""
    book = await book_service.get(book_id)
    return ApiResponse(success=True, data=_to_response(book), error=None)


@router.post(
    "",
    response_model=ApiResponse[BookResponse],
    status_code=201,
    summary="Create a book listing",
    response_description="The newly created book listing.",
    responses=error_responses(401, 403, 409),
)
async def create_book(
    payload: BookCreate,
    book_service: Annotated[BookService, Depends(get_book_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[BookResponse]:
    """Create a book listing. Sellers only (403 for customers)."""
    book = Book(
        title=payload.title,
        author=payload.author,
        isbn=payload.isbn,
        price=payload.price,
        stock=payload.stock,
        seller_id=current_user.id or _UNVALIDATED_SELLER_ID_PLACEHOLDER,
        description=payload.description,
        category=payload.category,
    )
    created = await book_service.create(current_user, book)
    return ApiResponse(success=True, data=_to_response(created), error=None)


@router.put(
    "/{book_id}",
    response_model=ApiResponse[BookResponse],
    summary="Update a book listing",
    response_description="The updated book listing.",
    responses=error_responses(401, 403, 404, 409),
)
async def update_book(
    book_id: int,
    payload: BookUpdate,
    book_service: Annotated[BookService, Depends(get_book_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[BookResponse]:
    """Update a book. Only its owning seller may do this (403 otherwise).

    The caller must send the `version` they read the book at. It travels
    untouched into the UPDATE's WHERE clause, so an update based on a stale
    read is rejected with 409 instead of overwriting a concurrent change.
    """
    changes = Book(
        title=payload.title,
        author=payload.author,
        isbn=payload.isbn,
        price=payload.price,
        stock=payload.stock,
        seller_id=current_user.id or _UNVALIDATED_SELLER_ID_PLACEHOLDER,
        description=payload.description,
        category=payload.category,
        version=payload.version,
    )
    updated = await book_service.update(current_user, book_id, changes)
    return ApiResponse(success=True, data=_to_response(updated), error=None)


@router.delete(
    "/{book_id}",
    response_model=ApiResponse[None],
    summary="Delete a book listing",
    response_description="The book listing was deleted.",
    responses=error_responses(401, 403, 404),
)
async def delete_book(
    book_id: int,
    book_service: Annotated[BookService, Depends(get_book_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[None]:
    """Delete a book. Only its owning seller may do this (403 otherwise)."""
    await book_service.delete(current_user, book_id)
    return ApiResponse(success=True, data=None, error=None)
