"""Generic API response envelope shared by all endpoints."""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

DataT = TypeVar("DataT")


class ApiResponse(BaseModel, Generic[DataT]):
    """Standard API response envelope: `{"success", "data", "error"}`."""

    success: bool
    data: DataT | None = None
    error: str | None = None


# Every error response in the app is `ApiResponse[None]` — FastAPI's automatic
# per-code documentation does not know this, and the `HTTPValidationError`
# shape it defaults to for its own errors is not what this app returns.
# `error_responses()` documents the real envelope with a representative
# example for each status code the error_handler middleware can produce
# (see `_STATUS_CODES` in `adapters/inbound/middleware/error_handler.py`).
_ERROR_DESCRIPTIONS: dict[int, str] = {
    401: "Missing or invalid authentication credentials.",
    403: "The authenticated user's role or ownership does not allow this operation.",
    404: "The requested resource does not exist.",
    409: "Conflict with the current state of the resource: a duplicate value, "
    "or the resource was modified by another request since it was loaded.",
}

_ERROR_EXAMPLES: dict[int, str] = {
    401: "Missing authentication credentials",
    403: "Only sellers can manage book listings",
    404: "Book 1 not found",
    409: "Conflict: the resource already exists",
}


def error_responses(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    """Build an OpenAPI `responses=` fragment for the given error status codes.

    Each entry documents the actual `ApiResponse[None]` envelope
    (`{"success": false, "data": null, "error": "..."}`) with a
    representative example message, instead of FastAPI's default schema.
    """
    return {
        status_code: {
            "model": ApiResponse[None],
            "description": _ERROR_DESCRIPTIONS[status_code],
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "data": None,
                        "error": _ERROR_EXAMPLES[status_code],
                    }
                }
            },
        }
        for status_code in status_codes
    }
