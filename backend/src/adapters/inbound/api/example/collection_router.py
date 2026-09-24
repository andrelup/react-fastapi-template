"""Catalogue collection endpoints: listing, read, create, update and delete.

The catalogue of collections is governed by the ADMIN role alone — no
ownership, unlike `Item`. Which collections an item belongs to is a
different question, resolved on the `Item` side: see
`PUT /items/{item_id}/collections` in `item_router.py`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from src.adapters.inbound.middleware.auth import get_current_user
from src.adapters.inbound.schemas.common import ApiResponse, error_responses
from src.adapters.inbound.schemas.example.collection_schemas import (
    CollectionCreate,
    CollectionResponse,
    CollectionUpdate,
    PaginatedCollections,
)
from src.config.container import get_collection_service
from src.domain.models.example.collection import Collection
from src.domain.models.user import User
from src.domain.services.example.collection_service import CollectionService

router = APIRouter(prefix="/collections", tags=["collections"])


def _to_response(collection: Collection) -> CollectionResponse:
    """Map a persisted domain `Collection` to its public API representation."""
    if collection.id is None:
        raise ValueError("Persisted collections must have an id")
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        version=collection.version,
    )


@router.get(
    "",
    response_model=ApiResponse[PaginatedCollections],
    summary="List the collection catalogue",
    response_description="A page of collections.",
    responses=error_responses(401),
)
async def list_collections(
    collection_service: Annotated[CollectionService, Depends(get_collection_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApiResponse[PaginatedCollections]:
    """Return a page of collections. Readable by every authenticated role."""
    collections, total = await collection_service.list_collections(page, page_size)
    page_response = PaginatedCollections(
        items=[_to_response(collection) for collection in collections],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=page_response, error=None)


@router.get(
    "/{collection_id}",
    response_model=ApiResponse[CollectionResponse],
    summary="Get one collection",
    response_description="The requested collection.",
    responses=error_responses(401, 404),
)
async def get_collection(
    collection_id: int,
    collection_service: Annotated[CollectionService, Depends(get_collection_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[CollectionResponse]:
    """Return a single collection by id."""
    collection = await collection_service.get_collection(collection_id)
    return ApiResponse(success=True, data=_to_response(collection), error=None)


@router.post(
    "",
    response_model=ApiResponse[CollectionResponse],
    status_code=201,
    summary="Create a collection",
    response_description="The newly created collection.",
    responses=error_responses(401, 403, 409),
)
async def create_collection(
    payload: CollectionCreate,
    collection_service: Annotated[CollectionService, Depends(get_collection_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[CollectionResponse]:
    """Create a collection. Requires ADMIN — see the module docstring for why."""
    collection = Collection(name=payload.name, description=payload.description)
    created = await collection_service.create(collection, current_user)
    return ApiResponse(success=True, data=_to_response(created), error=None)


@router.put(
    "/{collection_id}",
    response_model=ApiResponse[CollectionResponse],
    summary="Update a collection",
    response_description="The updated collection, with its new version.",
    responses=error_responses(401, 403, 404, 409),
)
async def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    collection_service: Annotated[CollectionService, Depends(get_collection_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[CollectionResponse]:
    """Update a collection. ADMIN only."""
    changes = Collection(
        name=payload.name, description=payload.description, version=payload.version
    )
    updated = await collection_service.update(collection_id, changes, current_user)
    return ApiResponse(success=True, data=_to_response(updated), error=None)


@router.delete(
    "/{collection_id}",
    response_model=ApiResponse[None],
    summary="Delete a collection",
    response_description="Confirmation that the collection was deleted.",
    responses=error_responses(401, 403, 404),
)
async def delete_collection(
    collection_id: int,
    collection_service: Annotated[CollectionService, Depends(get_collection_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[None]:
    """Delete a collection. ADMIN only."""
    await collection_service.delete(collection_id, current_user)
    return ApiResponse(success=True, data=None, error=None)
