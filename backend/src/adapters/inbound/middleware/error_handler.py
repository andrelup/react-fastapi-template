"""Translates domain exceptions into HTTP responses.

Domain services and inbound adapters raise `DomainError` subclasses
directly; this is the single place that maps them to HTTP status codes
and the standard `ApiResponse` envelope, per the hexagonal architecture
rules in `backend/CLAUDE.md`.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError

from src.adapters.inbound.schemas.common import ApiResponse
from src.domain.exceptions import (
    BookNotFoundError,
    BookValidationError,
    DomainError,
    DuplicateEmailError,
    DuplicateFavouriteBookError,
    DuplicateFavouriteListNameError,
    FavouriteListNotFoundError,
    FavouriteListValidationError,
    ForbiddenError,
    InvalidCredentialsError,
    UnauthorizedError,
)

_STATUS_CODES: dict[type[DomainError], int] = {
    BookNotFoundError: 404,
    UnauthorizedError: 401,
    InvalidCredentialsError: 401,
    ForbiddenError: 403,
    DuplicateEmailError: 409,
    BookValidationError: 422,
    FavouriteListNotFoundError: 404,
    DuplicateFavouriteListNameError: 409,
    DuplicateFavouriteBookError: 409,
    FavouriteListValidationError: 422,
}
_DEFAULT_STATUS_CODE = 500

# Leading segment Pydantic/FastAPI prepends to `loc` depending on where the
# failing field came from — stripped so the message reads `field: msg`
# instead of `body.field: msg`.
_LOC_PREFIXES = {"body", "query", "path"}

# The login route must answer every failure mode — unknown email, wrong
# password, or a malformed request body — with the exact same 401 message.
# Returning a field-specific 422 for e.g. an invalid email format would let
# an attacker distinguish "bad format" from "unknown email" from "wrong
# password", defeating the anti-enumeration guarantee the domain already
# provides via `InvalidCredentialsError`. Detecting the route by request
# path (rather than special-casing it in the router) keeps that guarantee
# centralized here, next to the rest of the error-to-HTTP translation.
_LOGIN_PATH = "/auth/login"
_INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"


def _format_validation_message(exc: RequestValidationError) -> str:
    """Build a `field: msg` message from Pydantic's error list.

    Only `loc` and `msg` are read. Pydantic v2 error dicts also carry an
    `input` key with the raw value that failed validation — e.g. a user's
    plaintext password on `/auth/register` — and a `ctx`/`url` pair with
    extra metadata. None of those must ever reach the response body or a
    log line, so they are deliberately never touched here.
    """
    parts: list[str] = []
    for error in exc.errors():
        loc = list(error["loc"])
        if loc and loc[0] in _LOC_PREFIXES:
            loc = loc[1:]
        field = ".".join(str(segment) for segment in loc) or "body"
        parts.append(f"{field}: {error['msg']}")
    return "; ".join(parts)


def register_exception_handlers(app: FastAPI) -> None:
    """Register domain exception handlers on the FastAPI app."""

    @app.exception_handler(DomainError)
    async def _handle_domain_error(_request: Request, exc: DomainError) -> JSONResponse:
        status_code = _STATUS_CODES.get(type(exc), _DEFAULT_STATUS_CODE)
        envelope = ApiResponse[None](success=False, data=None, error=str(exc))
        return JSONResponse(status_code=status_code, content=envelope.model_dump())

    @app.exception_handler(IntegrityError)
    async def _handle_integrity_error(_request: Request, _exc: IntegrityError) -> JSONResponse:
        # A DB-level constraint (typically a UniqueConstraint) rejected the write after
        # an in-memory availability check passed — a race between two concurrent requests.
        # The domain-level Duplicate*Error only catches the non-concurrent case.
        envelope = ApiResponse[None](
            success=False, data=None, error="Conflict: the resource already exists"
        )
        return JSONResponse(status_code=409, content=envelope.model_dump())

    @app.exception_handler(StaleDataError)
    async def _handle_stale_data_error(_request: Request, _exc: StaleDataError) -> JSONResponse:
        # Raised by SQLAlchemy's `version_id_col` optimistic locking when a
        # concurrent request already updated the row this request loaded —
        # the in-memory version no longer matches the one in the database.
        envelope = ApiResponse[None](
            success=False, data=None, error="Conflict: the resource was modified by another request"
        )
        return JSONResponse(status_code=409, content=envelope.model_dump())

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        if request.url.path == _LOGIN_PATH:
            envelope = ApiResponse[None](
                success=False, data=None, error=_INVALID_CREDENTIALS_MESSAGE
            )
            return JSONResponse(status_code=401, content=envelope.model_dump())

        envelope = ApiResponse[None](
            success=False, data=None, error=_format_validation_message(exc)
        )
        return JSONResponse(status_code=422, content=envelope.model_dump())
