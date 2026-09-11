"""Catalogue item endpoints: listing, search, read, create, update and delete."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.adapters.inbound.middleware.auth import get_current_user
from src.adapters.inbound.schemas.common import ApiResponse, error_responses
from src.adapters.inbound.schemas.example.item_schemas import (
    ItemCreate,
    ItemPageResponse,
    ItemResponse,
    ItemUpdate,
)
from src.config.container import get_item_service
from src.domain.models.example.item import Item
from src.domain.models.user import User
from src.domain.services.example.item_service import ItemService

router = APIRouter(prefix="/items", tags=["items"])


def _to_response(item: Item) -> ItemResponse:
    """Map a persisted domain `Item` to its public API representation."""
    if item.id is None:
        raise ValueError("Persisted items must have an id")
    return ItemResponse(
        id=item.id,
        name=item.name,
        slug=item.slug,
        description=item.description,
        category=item.category,
        tags=item.tag_names,
        owner_id=item.owner_id,
        version=item.version,
    )


async def _page(
    item_service: ItemService,
    query: str | None,
    category: str | None,
    page: int,
    page_size: int,
) -> ApiResponse[ItemPageResponse]:
    """Run the search use case and wrap its page in the response envelope."""
    items, total = await item_service.search(query, category, (page - 1) * page_size, page_size)
    page_response = ItemPageResponse(
        items=[_to_response(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=page_response, error=None)


@router.get(
    "",
    response_model=ApiResponse[ItemPageResponse],
    summary="List the catalogue",
    response_description="A page of items, optionally narrowed by category.",
    responses=error_responses(401),
)
async def list_items(
    item_service: Annotated[ItemService, Depends(get_item_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
    category: Annotated[str | None, Query(max_length=50)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApiResponse[ItemPageResponse]:
    """Return a page of catalogue items. Readable by every authenticated role."""
    return await _page(item_service, None, category, page, page_size)


# Declared BEFORE `/{item_id}` on purpose: Starlette matches routes in
# declaration order and `/{item_id}` happily accepts the literal "search",
# which would then fail `int` coercion as a 422 about a path parameter the
# client never sent. Specific routes before parametrised ones, always.
@router.get(
    "/search",
    response_model=ApiResponse[ItemPageResponse],
    summary="Search the catalogue",
    response_description="A page of items matching the query.",
    responses=error_responses(401),
)
async def search_items(
    item_service: Annotated[ItemService, Depends(get_item_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str | None, Query(max_length=200)] = None,
    category: Annotated[str | None, Query(max_length=50)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApiResponse[ItemPageResponse]:
    """Return a page of items whose name or description matches `q`."""
    return await _page(item_service, q, category, page, page_size)


@router.get(
    "/{item_id}",
    response_model=ApiResponse[ItemResponse],
    summary="Get one catalogue item",
    response_description="The requested item.",
    responses=error_responses(401, 404),
)
async def get_item(
    item_id: int,
    item_service: Annotated[ItemService, Depends(get_item_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[ItemResponse]:
    """Return a single item by id."""
    item = await item_service.get(item_id)
    return ApiResponse(success=True, data=_to_response(item), error=None)


@router.post(
    "",
    response_model=ApiResponse[ItemResponse],
    status_code=201,
    summary="Create a catalogue item",
    response_description="The newly created item.",
    responses=error_responses(401, 403, 409),
)
async def create_item(
    payload: ItemCreate,
    item_service: Annotated[ItemService, Depends(get_item_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[ItemResponse]:
    """Create an item owned by the authenticated user. Requires EDITOR or above."""
    item = Item(
        name=payload.name,
        slug=payload.slug,
        owner_id=0,  # replaced by the service with the authenticated user's id
        description=payload.description,
        category=payload.category,
        tag_names=payload.tags,
    )
    created = await item_service.create(item, current_user)
    return ApiResponse(success=True, data=_to_response(created), error=None)


@router.put(
    "/{item_id}",
    response_model=ApiResponse[ItemResponse],
    summary="Update a catalogue item",
    response_description="The updated item, with its new version.",
    responses=error_responses(401, 403, 404, 409),
)
async def update_item(
    item_id: int,
    payload: ItemUpdate,
    item_service: Annotated[ItemService, Depends(get_item_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[ItemResponse]:
    """Update an item. ADMIN may update any; EDITOR only its own."""
    changes = Item(
        name=payload.name,
        slug=payload.slug,
        owner_id=0,  # ownership never changes through this endpoint
        description=payload.description,
        category=payload.category,
        tag_names=payload.tags,
        version=payload.version,
    )
    updated = await item_service.update(item_id, changes, current_user)
    return ApiResponse(success=True, data=_to_response(updated), error=None)


@router.delete(
    "/{item_id}",
    response_model=ApiResponse[None],
    summary="Delete a catalogue item",
    response_description="Confirmation that the item was deleted.",
    responses=error_responses(401, 403, 404),
)
async def delete_item(
    item_id: int,
    item_service: Annotated[ItemService, Depends(get_item_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[None]:
    """Delete an item. ADMIN only."""
    await item_service.delete(item_id, current_user)
    return ApiResponse(success=True, data=None, error=None)
