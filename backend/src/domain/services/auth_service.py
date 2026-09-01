"""Authentication use cases: registration, login and identity resolution."""

from dataclasses import dataclass

from src.domain.exceptions import (
    DuplicateEmailError,
    InvalidCredentialsError,
    UnauthorizedError,
)
from src.domain.models.user import User, UserRole
from src.domain.ports.repositories import UserRepository
from src.domain.ports.services import PasswordHasher, TokenService


@dataclass
class AuthService:
    """Coordinates user registration, login and token-based identification.

    Depends only on domain ports, so it can be unit-tested with simple
    fakes/mocks and no database or web framework involved.
    """

    user_repository: UserRepository
    password_hasher: PasswordHasher
    token_service: TokenService

    async def register(self, email: str, name: str, password: str, role: UserRole) -> User:
        """Create a new user account with a securely hashed password.

        Raises:
            DuplicateEmailError: if a user with the same email already exists.
        """
        existing_user = await self.user_repository.find_by_email(email)
        if existing_user is not None:
            raise DuplicateEmailError(f"Email already registered: {email}")

        new_user = User(
            email=email,
            name=name,
            role=role,
            hashed_password=self.password_hasher.hash(password),
        )
        return await self.user_repository.save(new_user)

    async def login(self, email: str, password: str) -> tuple[User, str]:
        """Authenticate a user by email/password and issue an access token.

        Raises:
            InvalidCredentialsError: if the email is unknown or the password
                does not match.
        """
        user = await self.user_repository.find_by_email(email)
        if user is None or not self.password_hasher.verify(password, user.hashed_password):
            raise InvalidCredentialsError("Invalid email or password")

        access_token = self.token_service.create_access_token(subject=user.email)
        return user, access_token

    async def get_current_user(self, token: str) -> User:
        """Resolve the user identified by a previously issued access token.

        Raises:
            UnauthorizedError: if the token is invalid/expired or no longer
                matches an existing user.
        """
        email = self.token_service.decode_token(token)
        user = await self.user_repository.find_by_email(email)
        if user is None:
            raise UnauthorizedError("User not found for the given token")
        return user
