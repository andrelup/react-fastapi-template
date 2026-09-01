"""API tests for the health endpoint."""

from httpx import AsyncClient


async def test_health_check_returns_ok_envelope(client: AsyncClient) -> None:
    # Arrange — client fixture is already wired to the FastAPI app

    # Act
    response = await client.get("/health")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"status": "ok"}, "error": None}


async def test_health_check_rejects_non_get_methods(client: AsyncClient) -> None:
    # Arrange — /health is registered as GET only

    # Act
    response = await client.post("/health")

    # Assert
    assert response.status_code == 405
