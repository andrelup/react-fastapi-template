"""Authentication endpoints: register, login and current-user lookup."""

from fastapi import APIRouter, Depends

from src.adapters.inbound.middleware.auth import get_current_user
from src.adapters.inbound.schemas.auth_schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from src.adapters.inbound.schemas.common import ApiResponse, error_responses
from src.config.container import get_auth_service
from src.domain.models.user import User
from src.domain.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_user_response(user: User) -> UserResponse:
    """Map a persisted domain `User` to its public API representation."""
    if user.id is None:
        raise ValueError("Persisted users must have an id")
    return UserResponse(id=user.id, email=user.email, name=user.name, role=user.role)


@router.post(
    "/register",
    response_model=ApiResponse[UserResponse],
    status_code=201,
    summary="Register a new user account",
    response_description="The newly created user account.",
    responses=error_responses(409),
)
async def register(
    request: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> ApiResponse[UserResponse]:
    """Create a new user account."""
    user = await auth_service.register(
        email=request.email,
        name=request.name,
        password=request.password,
        role=request.role,
    )
    return ApiResponse(success=True, data=_to_user_response(user), error=None)


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    summary="Authenticate and obtain an access token",
    response_description="A JWT access token for the authenticated user.",
    responses=error_responses(401),
)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> ApiResponse[TokenResponse]:
    """Authenticate a user and issue a JWT access token."""
    user, access_token = await auth_service.login(request.email, request.password)
    token_response = TokenResponse(access_token=access_token, user=_to_user_response(user))
    return ApiResponse(success=True, data=token_response, error=None)


@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
    summary="Get the current authenticated user",
    response_description="The authenticated user.",
    responses=error_responses(401),
)
async def get_me(current_user: User = Depends(get_current_user)) -> ApiResponse[UserResponse]:
    """Return the currently authenticated user."""
    return ApiResponse(success=True, data=_to_user_response(current_user), error=None)
