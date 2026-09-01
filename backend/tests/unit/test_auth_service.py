"""Unit tests for AuthService — domain logic tested with mocked ports."""

import pytest
from src.domain.exceptions import DuplicateEmailError, InvalidCredentialsError, UnauthorizedError
from src.domain.models.user import User, UserRole
from src.domain.services.auth_service import AuthService


class FakeUserRepository:
    """In-memory fake implementing the `UserRepository` port."""

    def __init__(self, users: list[User] | None = None) -> None:
        self._users = list(users) if users else []
        self._next_id = 1

    async def find_by_id(self, user_id: int) -> User | None:
        return next((u for u in self._users if u.id == user_id), None)

    async def find_by_email(self, email: str) -> User | None:
        return next((u for u in self._users if u.email == email), None)

    async def save(self, user: User) -> User:
        saved_user = User(
            id=self._next_id,
            email=user.email,
            name=user.name,
            role=user.role,
            hashed_password=user.hashed_password,
        )
        self._next_id += 1
        self._users.append(saved_user)
        return saved_user


class FakePasswordHasher:
    """Fake implementing the `PasswordHasher` port with a reversible 'hash'."""

    def hash(self, plain_password: str) -> str:
        return f"hashed:{plain_password}"

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        return hashed_password == f"hashed:{plain_password}"


class FakeTokenService:
    """Fake implementing the `TokenService` port with predictable tokens."""

    def create_access_token(self, subject: str) -> str:
        return f"token-for:{subject}"

    def decode_token(self, token: str) -> str:
        if not token.startswith("token-for:"):
            raise UnauthorizedError("Invalid or expired token")
        return token.removeprefix("token-for:")


def make_auth_service(users: list[User] | None = None) -> AuthService:
    """Build an `AuthService` wired with in-memory fakes for its ports."""
    return AuthService(
        user_repository=FakeUserRepository(users),
        password_hasher=FakePasswordHasher(),
        token_service=FakeTokenService(),
    )


async def test_register_creates_a_new_user() -> None:
    # Arrange
    sut = make_auth_service()

    # Act
    user = await sut.register(
        email="new@example.com",
        name="New User",
        password="s3cret123",
        role=UserRole.CUSTOMER,
    )

    # Assert
    assert user.id is not None
    assert user.email == "new@example.com"
    assert user.role == UserRole.CUSTOMER
    assert user.hashed_password == "hashed:s3cret123"


async def test_register_when_email_already_registered_raises_duplicate_email_error() -> None:
    # Arrange
    existing_user = User(
        id=1,
        email="taken@example.com",
        name="Existing",
        role=UserRole.CUSTOMER,
        hashed_password="hashed:whatever",
    )
    sut = make_auth_service([existing_user])

    # Act / Assert
    with pytest.raises(DuplicateEmailError):
        await sut.register(
            email="taken@example.com", name="Someone", password="pw", role=UserRole.CUSTOMER
        )


async def test_login_with_valid_credentials_returns_user_and_token() -> None:
    # Arrange
    existing_user = User(
        id=1,
        email="user@example.com",
        name="User",
        role=UserRole.SELLER,
        hashed_password="hashed:correct-pw",
    )
    sut = make_auth_service([existing_user])

    # Act
    user, token = await sut.login("user@example.com", "correct-pw")

    # Assert
    assert user.email == "user@example.com"
    assert user.role == UserRole.SELLER
    assert token == "token-for:user@example.com"


async def test_login_with_unknown_email_raises_invalid_credentials_error() -> None:
    # Arrange
    sut = make_auth_service()

    # Act / Assert
    with pytest.raises(InvalidCredentialsError):
        await sut.login("ghost@example.com", "whatever")


async def test_login_with_wrong_password_raises_invalid_credentials_error() -> None:
    # Arrange
    existing_user = User(
        id=1,
        email="user@example.com",
        name="User",
        role=UserRole.CUSTOMER,
        hashed_password="hashed:correct-pw",
    )
    sut = make_auth_service([existing_user])

    # Act / Assert
    with pytest.raises(InvalidCredentialsError):
        await sut.login("user@example.com", "wrong-pw")


async def test_get_current_user_with_valid_token_returns_user() -> None:
    # Arrange
    existing_user = User(
        id=1,
        email="user@example.com",
        name="User",
        role=UserRole.CUSTOMER,
        hashed_password="hashed:pw",
    )
    sut = make_auth_service([existing_user])

    # Act
    user = await sut.get_current_user("token-for:user@example.com")

    # Assert
    assert user.email == "user@example.com"


async def test_get_current_user_with_invalid_token_raises_unauthorized_error() -> None:
    # Arrange
    sut = make_auth_service()

    # Act / Assert
    with pytest.raises(UnauthorizedError):
        await sut.get_current_user("garbage-token")


async def test_get_current_user_when_user_no_longer_exists_raises_unauthorized_error() -> None:
    # Arrange
    sut = make_auth_service()

    # Act / Assert
    with pytest.raises(UnauthorizedError):
        await sut.get_current_user("token-for:ghost@example.com")
