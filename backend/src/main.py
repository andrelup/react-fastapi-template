"""FastAPI application entrypoint.

Registers routers and middleware. Must not trigger any database
connection or other side effects at import time.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.adapters.inbound.api.auth_router import router as auth_router
from src.adapters.inbound.api.book_router import router as book_router
from src.adapters.inbound.api.favourite_list_router import router as favourite_list_router
from src.adapters.inbound.api.health_router import router as health_router
from src.adapters.inbound.middleware.error_handler import register_exception_handlers
from src.adapters.inbound.middleware.logging import RequestLoggingMiddleware
from src.config.logging import configure_logging
from src.config.settings import settings

# Pure in-process configuration (structlog processors, stdlib logging
# dictConfig) — no socket, file or database access, so it does not violate
# the "no side effects at import time" rule above. It must run before the
# app is built so the very first log line already goes through the
# configured pipeline.
configure_logging()

app = FastAPI(title=settings.app_name, version="0.1.0")

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registered after CORS: Starlette applies `add_middleware` in reverse
# registration order (last added = outermost), so this middleware wraps
# CORS and observes the real response status code, including preflight
# responses, for every request it logs.
app.add_middleware(RequestLoggingMiddleware)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(book_router)
app.include_router(favourite_list_router)
