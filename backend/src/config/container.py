"""Dependency injection wiring: connects domain ports to concrete adapters.

This is the only module allowed to import from both `domain` and
`adapters` to wire ports (Protocols) to their concrete implementations.
Routers depend on the functions below via FastAPI's `Depends`, never on
the adapters directly.
"""

from functools import lru_cache

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapters.outbound.persistence.database import get_db_session
from src.adapters.outbound.persistence.example.collection_repository import (
    SqlAlchemyCollectionRepository,
)
from src.adapters.outbound.persistence.example.item_repository import SqlAlchemyItemRepository
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.adapters.outbound.security.jwt_token_service import JwtTokenService
from src.adapters.outbound.security.password_hasher import BcryptPasswordHasher
from src.config.settings import settings
from src.domain.ports.example.repositories import CollectionRepository, ItemRepository
from src.domain.ports.repositories import UserRepository
from src.domain.ports.services import PasswordHasher, TokenService
from src.domain.services.auth_service import AuthService
from src.domain.services.example.collection_service import CollectionService
from src.domain.services.example.item_service import ItemService


def get_user_repository(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    """Provide the SQLAlchemy-backed `UserRepository` implementation."""
    return SqlAlchemyUserRepository(session)


@lru_cache
def get_password_hasher() -> PasswordHasher:
    """Provide the bcrypt-backed `PasswordHasher` implementation (stateless)."""
    return BcryptPasswordHasher()


@lru_cache
def get_token_service() -> TokenService:
    """Provide the JWT-backed `TokenService` implementation (stateless)."""
    return JwtTokenService(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.jwt_access_token_expires_minutes,
    )


def get_auth_service(
    user_repository: UserRepository = Depends(get_user_repository),
    password_hasher: PasswordHasher = Depends(get_password_hasher),
    token_service: TokenService = Depends(get_token_service),
) -> AuthService:
    """Wire the `AuthService` use case with its concrete port implementations."""
    return AuthService(
        user_repository=user_repository,
        password_hasher=password_hasher,
        token_service=token_service,
    )


def get_item_repository(session: AsyncSession = Depends(get_db_session)) -> ItemRepository:
    """Provide the SQLAlchemy-backed `ItemRepository` implementation."""
    return SqlAlchemyItemRepository(session)


def get_collection_repository(
    session: AsyncSession = Depends(get_db_session),
) -> CollectionRepository:
    """Provide the SQLAlchemy-backed `CollectionRepository` implementation."""
    return SqlAlchemyCollectionRepository(session)


def get_item_service(
    item_repository: ItemRepository = Depends(get_item_repository),
    collection_repository: CollectionRepository = Depends(get_collection_repository),
) -> ItemService:
    """Wire the `ItemService` use case with its concrete port implementations.

    `ItemService` needs `CollectionRepository` too: `set_collections`
    resolves the collection ids a caller sends against the catalogue before
    writing them onto the item.
    """
    return ItemService(item_repository, collection_repository)


def get_collection_service(
    collection_repository: CollectionRepository = Depends(get_collection_repository),
) -> CollectionService:
    """Wire the `CollectionService` use case with its concrete port implementation."""
    return CollectionService(collection_repository)
