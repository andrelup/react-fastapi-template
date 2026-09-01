"""User domain model.

Plain dataclass, independent of any persistence or web framework.
"""

from dataclasses import dataclass
from enum import StrEnum


class UserRole(StrEnum):
    """Role a user account can have within the store."""

    CUSTOMER = "customer"
    SELLER = "seller"


@dataclass(frozen=True, slots=True)
class User:
    """A registered user of the BookShelf store."""

    email: str
    name: str
    role: UserRole
    hashed_password: str
    id: int | None = None
