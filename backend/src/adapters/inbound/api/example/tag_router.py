"""Catalogue tag endpoints: search and ensure-exists.

`POST /tags` is not a creation endpoint in the usual sense — see its docstring
below — which is why it is named `ensure_tag_exists` rather than `create_tag`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from src.adapters.inbound.middleware.auth import get_current_user
from src.adapters.inbound.schemas.common import ApiResponse, error_responses
from src.adapters.inbound.schemas.example.tag_schemas import (
    TagEnsureExists,
    TagListResponse,
    TagResponse,
)
from src.config.container import get_tag_service
from src.domain.models.example.tag import Tag
from src.domain.models.user import User
from src.domain.services.example.tag_service import TagService

router = APIRouter(prefix="/tags", tags=["tags"])

# The consumer is a dropdown that never goes past the first page — see
# `TagListResponse` — so the search is capped rather than paginated.
_SEARCH_LIMIT = 50


def _to_response(tag: Tag) -> TagResponse:
    """Map a persisted domain `Tag` to its public API representation."""
    if tag.id is None:
        raise ValueError("Persisted tags must have an id")
    return TagResponse(id=tag.id, name=tag.name)


@router.get(
    "",
    response_model=ApiResponse[TagListResponse],
    summary="Search the tag catalogue",
    response_description="Up to 50 tags matching the query, ordered by name.",
    responses=error_responses(401),
)
async def search_tags(
    tag_service: Annotated[TagService, Depends(get_tag_service)],
    _current_user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str | None, Query(max_length=50)] = None,
) -> ApiResponse[TagListResponse]:
    """Return up to 50 tags whose name matches `q`, or the first 50 by name if `q` is empty.

    Readable by every authenticated role. Deliberately not joined against
    `item_tags`: a tag attached to no item is still a real row in the
    vocabulary, and is meant to surface here too.
    """
    tags = await tag_service.search(q, _SEARCH_LIMIT)
    return ApiResponse(
        success=True, data=TagListResponse(tags=[_to_response(tag) for tag in tags]), error=None
    )


@router.post(
    "",
    response_model=ApiResponse[TagResponse],
    status_code=200,
    summary="Ensure a tag exists",
    response_description="The tag, existing or newly created, with its id.",
    responses=error_responses(401, 403),
)
async def ensure_tag_exists(
    payload: TagEnsureExists,
    response: Response,
    tag_service: Annotated[TagService, Depends(get_tag_service)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ApiResponse[TagResponse]:
    """Make sure a tag with this name exists, and return its id.

    This does not "create a tag" — half the time it does not. It is
    idempotent: a name that already exists returns 200 with the existing
    row's id; a new name returns 201 with the newly assigned one. Either way
    the caller ends up with an id, which is the point: the dropdown's list of
    suggestions may already be stale by the time the user picks one. Requires
    at least EDITOR, the same minimum `POST /items` enforces.
    """
    tag, created = await tag_service.ensure_exists(payload.name, current_user)
    if created:
        response.status_code = 201
    return ApiResponse(success=True, data=_to_response(tag), error=None)
