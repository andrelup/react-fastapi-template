"""Unit tests for the domain-error-to-HTTP translation in error_handler.py."""

from collections.abc import AsyncGenerator

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.exc import IntegrityError
from src.adapters.inbound.middleware.error_handler import register_exception_handlers
from src.domain.exceptions import (
    DomainError,
    DuplicateEmailError,
    ForbiddenError,
    InvalidCredentialsError,
    UnauthorizedError,
)


def _make_app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/unauthorized")
    async def unauthorized() -> None:
        raise UnauthorizedError("Missing authentication credentials")

    @app.get("/forbidden")
    async def forbidden() -> None:
        raise ForbiddenError("You do not have permission to perform this action")

    @app.get("/invalid-credentials")
    async def invalid_credentials() -> None:
        raise InvalidCredentialsError("Email or password is incorrect")

    @app.get("/duplicate-email")
    async def duplicate_email() -> None:
        raise DuplicateEmailError("Email already registered")

    @app.get("/unmapped")
    async def unmapped() -> None:
        raise DomainError("Something went wrong")

    @app.get("/integrity-error")
    async def integrity_error() -> None:
        raise IntegrityError("statement", {}, Exception("duplicate key value"))

    return app


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = httpx.ASGITransport(app=_make_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


@pytest.mark.parametrize(
    ("path", "expected_status", "expected_error"),
    [
        ("/unauthorized", 401, "Missing authentication credentials"),
        ("/forbidden", 403, "You do not have permission to perform this action"),
        ("/invalid-credentials", 401, "Email or password is incorrect"),
        ("/duplicate-email", 409, "Email already registered"),
        ("/unmapped", 500, "Something went wrong"),
        ("/integrity-error", 409, "Conflict: the resource already exists"),
    ],
)
async def test_domain_error_handler_maps_each_exception_to_its_status(
    client: httpx.AsyncClient, path: str, expected_status: int, expected_error: str
) -> None:
    # Act
    response = await client.get(path)

    # Assert
    assert response.status_code == expected_status
    assert response.json() == {"success": False, "data": None, "error": expected_error}
