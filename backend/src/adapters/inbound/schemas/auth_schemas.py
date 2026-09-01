"""Request/response schemas for the authentication endpoints."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.domain.models.user import UserRole


class RegisterRequest(BaseModel):
    """Payload to create a new user account."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "jane.doe@example.com",
                "name": "Jane Doe",
                "password": "correct-horse-battery-staple",
                "role": "customer",
            }
        }
    )

    email: EmailStr = Field(examples=["jane.doe@example.com"])
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = Field(
        default=UserRole.CUSTOMER, description="Role granted to the new account."
    )


class LoginRequest(BaseModel):
    """Payload to authenticate an existing user."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "jane.doe@example.com",
                "password": "correct-horse-battery-staple",
            }
        }
    )

    email: EmailStr = Field(examples=["jane.doe@example.com"])
    password: str


class UserResponse(BaseModel):
    """Public representation of a user, safe to return over the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    role: UserRole = Field(description="Role held by this account.")


class TokenResponse(BaseModel):
    """Access token issued after a successful login."""

    access_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth2 token type label, not a secret.
    user: UserResponse
