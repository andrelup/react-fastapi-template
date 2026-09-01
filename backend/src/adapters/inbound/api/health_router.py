"""Health check endpoint."""

from fastapi import APIRouter

from src.adapters.inbound.schemas.common import ApiResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=ApiResponse[dict[str, str]],
    summary="Check service health",
    response_description="The service is up and running.",
)
async def health_check() -> ApiResponse[dict[str, str]]:
    """Return the service health status."""
    return ApiResponse(success=True, data={"status": "ok"}, error=None)
