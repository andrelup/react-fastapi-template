"""JWT authentication dependency, used to protect routes."""

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config.container import get_auth_service
from src.domain.exceptions import UnauthorizedError
from src.domain.models.user import User
from src.domain.services.auth_service import AuthService

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> User:
    """Resolve the authenticated user from the `Authorization: Bearer <token>` header.

    Raises:
        UnauthorizedError: if the header is missing or the token is invalid,
            translated to HTTP 401 by the error_handler middleware.
    """
    if credentials is None:
        raise UnauthorizedError("Missing authentication credentials")

    return await auth_service.get_current_user(credentials.credentials)
