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
from src.config.settings import settings

app = FastAPI(title=settings.app_name, version="0.1.0")

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(book_router)
app.include_router(favourite_list_router)
