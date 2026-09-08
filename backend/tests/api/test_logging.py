"""API tests for structured request logging and `request_id` correlation.

Exercises `RequestLoggingMiddleware` on the real app (via the `client`
fixture from `tests/api/conftest.py`): one request that succeeds and one
that triggers a mapped domain error, asserting the `request_id` captured in
the logs matches the `X-Request-ID` response header in both cases.
"""

import httpx
import structlog
from src.adapters.inbound.middleware.logging import REQUEST_ID_HEADER

# `capture_logs` disables every configured processor for its duration, so the
# contextvars binding the middleware relies on must be re-added explicitly
# for `request_id` to show up in events logged deeper in the call stack
# (e.g. the domain-error handler), which read it from the contextvars.
_CONTEXTVARS_PROCESSOR = (structlog.contextvars.merge_contextvars,)


async def test_get_health_logs_request_id_matching_response_header(
    client: httpx.AsyncClient,
) -> None:
    # Arrange / Act
    with structlog.testing.capture_logs(processors=_CONTEXTVARS_PROCESSOR) as captured:
        response = await client.get("/health")

    # Assert
    assert response.status_code == 200
    response_request_id = response.headers[REQUEST_ID_HEADER]
    assert response_request_id

    [request_event] = [entry for entry in captured if entry["event"] == "http_request"]
    assert request_event["request_id"] == response_request_id
    assert request_event["method"] == "GET"
    assert request_event["path"] == "/health"
    assert request_event["status_code"] == 200
    assert request_event["log_level"] == "info"


async def test_get_book_when_unauthenticated_logs_domain_error_with_matching_request_id(
    client: httpx.AsyncClient,
) -> None:
    # Arrange / Act - no `authenticated_as(...)` call, so `get_current_user`
    # raises the real `UnauthorizedError`, mapped by error_handler.py to 401.
    with structlog.testing.capture_logs(processors=_CONTEXTVARS_PROCESSOR) as captured:
        response = await client.get("/books/1")

    # Assert
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["error"] == "Missing authentication credentials"

    response_request_id = response.headers[REQUEST_ID_HEADER]
    [request_event] = [entry for entry in captured if entry["event"] == "http_request"]
    [domain_error_event] = [entry for entry in captured if entry["event"] == "domain_error"]

    assert request_event["request_id"] == response_request_id
    assert request_event["status_code"] == 401
    # The middleware always logs a completed request at info; severity for
    # the failure itself lives in the domain_error line below.
    assert request_event["log_level"] == "info"

    # The domain-error log is emitted deep inside the exception handler,
    # correlated to the same request purely via contextvars.
    assert domain_error_event["request_id"] == response_request_id
    assert domain_error_event["log_level"] == "warning"
