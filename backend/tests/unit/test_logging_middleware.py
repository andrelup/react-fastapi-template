"""Unit tests for `RequestLoggingMiddleware` in logging.py."""

from collections.abc import AsyncGenerator

import httpx
import pytest
import structlog
from fastapi import FastAPI
from src.adapters.inbound.middleware.logging import (
    _SAFE_REQUEST_ID,
    REQUEST_ID_HEADER,
    RequestLoggingMiddleware,
)

# `capture_logs` disables every configured processor for its duration, so the
# contextvars binding the middleware relies on must be re-added explicitly
# for `request_id` to show up in the captured events.
_CONTEXTVARS_PROCESSOR = (structlog.contextvars.merge_contextvars,)


def _make_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/ok")
    async def ok() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("boom")

    return app


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    transport = httpx.ASGITransport(app=_make_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


async def test_dispatch_when_request_succeeds_logs_request_id_and_duration(
    client: httpx.AsyncClient,
) -> None:
    # Arrange / Act
    with structlog.testing.capture_logs(processors=_CONTEXTVARS_PROCESSOR) as captured:
        response = await client.get("/ok")

    # Assert - the header the caller receives matches the one that was logged.
    assert response.status_code == 200
    response_request_id = response.headers[REQUEST_ID_HEADER]
    assert response_request_id

    [event] = [entry for entry in captured if entry["event"] == "http_request"]
    assert event["request_id"] == response_request_id
    assert event["method"] == "GET"
    assert event["path"] == "/ok"
    assert event["status_code"] == 200
    assert event["log_level"] == "info"
    assert isinstance(event["duration_ms"], float)
    assert event["duration_ms"] >= 0


async def test_dispatch_when_no_inbound_request_id_generates_one(
    client: httpx.AsyncClient,
) -> None:
    # Act
    response = await client.get("/ok")

    # Assert
    assert REQUEST_ID_HEADER in response.headers
    assert len(response.headers[REQUEST_ID_HEADER]) > 0


async def test_dispatch_when_inbound_request_id_header_present_reuses_it(
    client: httpx.AsyncClient,
) -> None:
    # Arrange
    inbound_request_id = "caller-supplied-id"

    # Act
    response = await client.get("/ok", headers={REQUEST_ID_HEADER: inbound_request_id})

    # Assert
    assert response.headers[REQUEST_ID_HEADER] == inbound_request_id


@pytest.mark.parametrize(
    "hostile_request_id",
    ["id with spaces", "forged\tlevel=error", "a" * 65, ""],
)
async def test_dispatch_when_inbound_request_id_header_is_malformed_generates_a_new_one(
    client: httpx.AsyncClient,
    hostile_request_id: str,
) -> None:
    # Arrange / Act
    response = await client.get("/ok", headers={REQUEST_ID_HEADER: hostile_request_id})

    # Assert
    assert response.headers[REQUEST_ID_HEADER] != hostile_request_id
    assert _SAFE_REQUEST_ID.match(response.headers[REQUEST_ID_HEADER])


async def test_dispatch_when_request_raises_logs_error_with_status_500(
    client: httpx.AsyncClient,
) -> None:
    # Arrange / Act
    with (
        structlog.testing.capture_logs(processors=_CONTEXTVARS_PROCESSOR) as captured,
        pytest.raises(RuntimeError, match="boom"),
    ):
        await client.get("/boom")

    # Assert
    [event] = [entry for entry in captured if entry["event"] == "http_request"]
    assert event["status_code"] == 500
    assert event["log_level"] == "error"
    assert event["path"] == "/boom"
    assert event["request_id"]
