"""API tests for CORS preflight handling."""

from httpx import AsyncClient
from src.config.settings import settings


async def test_preflight_from_allowed_origin_gets_cors_headers(client: AsyncClient) -> None:
    # Arrange — an origin taken from CORS_ALLOWED_ORIGINS, whatever the
    # environment's .env (or CI's) sets it to: there is no default to assume
    origin = settings.cors_allowed_origins[0]

    # Act
    response = await client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
        },
    )

    # Assert
    assert response.status_code in (200, 204)
    assert response.headers["access-control-allow-origin"] == origin


async def test_preflight_from_disallowed_origin_gets_no_cors_headers(
    client: AsyncClient,
) -> None:
    # Arrange — an origin that is not part of CORS_ALLOWED_ORIGINS

    # Act
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://evil.example.com",
            "Access-Control-Request-Method": "POST",
        },
    )

    # Assert
    assert "access-control-allow-origin" not in response.headers
