"""User domain model.

Plain dataclass, independent of any persistence or web framework.
"""

from dataclasses import dataclass
from enum import StrEnum


class UserRole(StrEnum):
    """Role a user account can have."""

    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


@dataclass(frozen=True, slots=True)
class User:
    """A registered user of the application."""

    email: str
    name: str
    role: UserRole
    hashed_password: str
    id: int | None = None


_ROLE_RANK: dict[UserRole, int] = {UserRole.VIEWER: 0, UserRole.EDITOR: 1, UserRole.ADMIN: 2}


def has_role(user: User, minimum: UserRole) -> bool:
    """True when `user` holds `minimum` or a role above it in the hierarchy."""
    return _ROLE_RANK[user.role] >= _ROLE_RANK[minimum]
