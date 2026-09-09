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
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.adapters.outbound.security.jwt_token_service import JwtTokenService
from src.adapters.outbound.security.password_hasher import BcryptPasswordHasher
from src.config.settings import settings
from src.domain.ports.repositories import UserRepository
from src.domain.ports.services import PasswordHasher, TokenService
from src.domain.services.auth_service import AuthService


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
