"""Structured, correlated request logging middleware.

Binds a request-scoped `request_id` into `structlog`'s contextvars on entry
so every log line emitted anywhere while the request is handled — routers,
domain services, repositories, the error handlers — carries it automatically,
then emits one structured `http_request` event per request with `method`,
`path`, `status_code` and `duration_ms`.
"""

import re
import time
import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

logger = structlog.get_logger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"

# An inbound request id is caller-controlled: it is echoed back in a response
# header and written into every log line of the request. Only a conservative
# token is reused — anything else is discarded in favour of a fresh id, which
# stops a caller from forging log entries or injecting header content.
_SAFE_REQUEST_ID = re.compile(r"\A[A-Za-z0-9_-]{1,64}\Z")


def _resolve_request_id(inbound: str | None) -> str:
    """Reuse a well-formed inbound request id, otherwise mint a new one."""
    if inbound is not None and _SAFE_REQUEST_ID.match(inbound):
        return inbound
    return uuid.uuid4().hex


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs one structured `http_request` event per request, correlated by `request_id`."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _resolve_request_id(request.headers.get(REQUEST_ID_HEADER))
        request.state.request_id = request_id
        structlog.contextvars.bind_contextvars(request_id=request_id)
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                "http_request",
                method=request.method,
                path=request.url.path,
                status_code=500,
                duration_ms=duration_ms,
                request_id=request_id,
                exc_info=True,
            )
            raise
        finally:
            structlog.contextvars.clear_contextvars()

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            request_id=request_id,
        )
        return response
