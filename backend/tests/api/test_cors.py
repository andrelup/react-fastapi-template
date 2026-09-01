"""API tests for CORS preflight handling."""

from httpx import AsyncClient


async def test_preflight_from_allowed_origin_gets_cors_headers(client: AsyncClient) -> None:
    # Arrange — the default CORS_ALLOWED_ORIGINS includes http://localhost:3000

    # Act
    response = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    # Assert
    assert response.status_code in (200, 204)
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


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
