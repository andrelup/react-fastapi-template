"""SQLAlchemy ORM models — kept separate from domain models.

Domain models (`src/domain/models/`) are plain dataclasses; these are the
persistence-specific counterparts, mapped to/from the domain via the
mapper functions in the matching `*_repository.py` module.
"""

from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


class UserORM(Base):
    """`users` table."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
