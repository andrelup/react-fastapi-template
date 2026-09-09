"""Persistence ports (Protocol interfaces) exposed by the domain."""

from typing import Protocol

from src.domain.models.user import User


class UserRepository(Protocol):
    """Persistence contract for `User` aggregates."""

    async def find_by_id(self, user_id: int) -> User | None:
        """Return the user with the given id, or None if it does not exist."""
        ...

    async def find_by_email(self, email: str) -> User | None:
        """Return the user with the given email, or None if it does not exist."""
        ...

    async def save(self, user: User) -> User:
        """Persist a user, inserting it if `user.id` is None or updating it otherwise."""
        ...
