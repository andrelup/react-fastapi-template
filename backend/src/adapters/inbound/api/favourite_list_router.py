"""Favourite lists endpoints: a customer's named lists of favourite books.

Authorization rules (enforced by `FavouriteListService`, translated to HTTP by
the error_handler middleware):
    - Only customers may use these endpoints (403 for sellers).
    - A customer may only read and edit their own lists; a list that doesn't
      exist or that belongs to another customer both return 404, so probing
      another customer's list ids can't be distinguished from a typo
      (anti-enumeration — see `FavouriteListService._get_owned_or_raise`).
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from src.adapters.inbound.middleware.auth import get_current_user
from src.adapters.inbound.schemas.common import ApiResponse, error_responses
from src.adapters.inbound.schemas.favourite_schemas import (
    FavouriteListCollectionResponse,
    FavouriteListCreate,
    FavouriteListItemCreate,
    FavouriteListResponse,
    FavouriteListUpdate,
)
from src.config.container import get_favourite_list_service
from src.domain.models.favourite import FavouriteList
from src.domain.models.user import User
from src.domain.services.favourite_list_service import FavouriteListService

router = APIRouter(prefix="/favourite-lists", tags=["favourite-lists"])


def _to_response(favourite_list: FavouriteList) -> FavouriteListResponse:
    if favourite_list.id is None:
        raise ValueError("Cannot build a response for a favourite list without an id")
    return FavouriteListResponse(
        id=favourite_list.id,
        owner_id=favourite_list.owner_id,
        name=favourite_list.name,
        book_ids=favourite_list.book_ids,
        version=favourite_list.version,
    )


@router.post(
    "",
    response_model=ApiResponse[FavouriteListResponse],
    status_code=201,
    summary="Create a favourite list",
    response_description="The newly created favourite list.",
    responses=error_responses(401, 403, 409),
)
async def create_favourite_list(
    payload: FavouriteListCreate,
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[FavouriteListResponse]:
    """Create a favourite list. Customers only (403 for sellers)."""
    created = await favourite_list_service.create(current_user, payload.name)
    return ApiResponse(success=True, data=_to_response(created), error=None)


@router.get(
    "",
    response_model=ApiResponse[FavouriteListCollectionResponse],
    summary="List your favourite lists",
    response_description="The caller's favourite lists.",
    responses=error_responses(401, 403),
)
async def list_favourite_lists(
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[FavouriteListCollectionResponse]:
    """List the caller's favourite lists. Customers only (403 for sellers)."""
    lists = await favourite_list_service.list_for_owner(current_user)
    data = FavouriteListCollectionResponse(
        items=[_to_response(favourite_list) for favourite_list in lists],
        total=len(lists),
    )
    return ApiResponse(success=True, data=data, error=None)


@router.get(
    "/{list_id}",
    response_model=ApiResponse[FavouriteListResponse],
    summary="Get a favourite list",
    response_description="The requested favourite list.",
    responses=error_responses(401, 403, 404),
)
async def get_favourite_list(
    list_id: int,
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[FavouriteListResponse]:
    """Get one favourite list and its books. Customers only (403 for sellers);
    404 if the list doesn't exist or isn't owned by the caller."""
    favourite_list = await favourite_list_service.get(current_user, list_id)
    return ApiResponse(success=True, data=_to_response(favourite_list), error=None)


@router.put(
    "/{list_id}",
    response_model=ApiResponse[FavouriteListResponse],
    summary="Rename a favourite list",
    response_description="The renamed favourite list.",
    responses=error_responses(401, 403, 404, 409),
)
async def rename_favourite_list(
    list_id: int,
    payload: FavouriteListUpdate,
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[FavouriteListResponse]:
    """Rename a favourite list. Customers only (403 for sellers); 404 if the
    list doesn't exist or isn't owned by the caller.

    The caller must send the `version` they read the list at. It travels
    untouched into the UPDATE's WHERE clause, so a rename based on a stale
    read is rejected with 409 instead of overwriting a concurrent change.
    """
    updated = await favourite_list_service.rename(
        current_user, list_id, payload.name, payload.version
    )
    return ApiResponse(success=True, data=_to_response(updated), error=None)


@router.delete(
    "/{list_id}",
    response_model=ApiResponse[None],
    summary="Delete a favourite list",
    response_description="The favourite list was deleted.",
    responses=error_responses(401, 403, 404),
)
async def delete_favourite_list(
    list_id: int,
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[None]:
    """Delete a favourite list and its items. Customers only (403 for sellers);
    404 if the list doesn't exist or isn't owned by the caller."""
    await favourite_list_service.delete(current_user, list_id)
    return ApiResponse(success=True, data=None, error=None)


@router.post(
    "/{list_id}/books",
    response_model=ApiResponse[FavouriteListResponse],
    status_code=201,
    summary="Add a book to a favourite list",
    response_description="The favourite list with the book added.",
    responses=error_responses(401, 403, 404, 409),
)
async def add_book_to_favourite_list(
    list_id: int,
    payload: FavouriteListItemCreate,
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[FavouriteListResponse]:
    """Add a catalog book to a favourite list. Customers only (403 for sellers);
    404 if the list or the book doesn't exist, or the list isn't owned by the caller."""
    updated = await favourite_list_service.add_book(current_user, list_id, payload.book_id)
    return ApiResponse(success=True, data=_to_response(updated), error=None)


@router.delete(
    "/{list_id}/books/{book_id}",
    response_model=ApiResponse[FavouriteListResponse],
    summary="Remove a book from a favourite list",
    response_description="The favourite list with the book removed.",
    responses=error_responses(401, 403, 404, 409),
)
async def remove_book_from_favourite_list(
    list_id: int,
    book_id: int,
    favourite_list_service: Annotated[FavouriteListService, Depends(get_favourite_list_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[FavouriteListResponse]:
    """Remove a book from a favourite list. Customers only (403 for sellers);
    404 if the list doesn't exist or isn't owned by the caller. Removing a
    book that is not in the list is a no-op, not an error."""
    updated = await favourite_list_service.remove_book(current_user, list_id, book_id)
    return ApiResponse(success=True, data=_to_response(updated), error=None)
