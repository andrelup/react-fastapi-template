"""SQLAlchemy ORM models — kept separate from domain models.

Domain models (`src/domain/models/`) are plain dataclasses; these are the
persistence-specific counterparts, mapped to/from the domain via the
mapper functions in the matching `*_repository.py` module.
"""

from sqlalchemy import ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


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


class BookORM(Base):
    """ORM mapping for the `books` table.

    `seller_id` is a foreign key to `users.id`. `version` backs SQLAlchemy's
    native optimistic locking (`version_id_col`): every UPDATE checks the
    in-memory version against the row's current version and increments it,
    raising `StaleDataError` if a concurrent write already bumped it.
    """

    __tablename__ = "books"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    author: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    isbn: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    stock: Mapped[int] = mapped_column(nullable=False, default=0)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[int] = mapped_column(nullable=False, default=1)

    __mapper_args__ = {"version_id_col": version}


class FavouriteListORM(Base):
    """ORM mapping for the `favourite_lists` table.

    A customer's named list of favourite books. `owner_id` is a foreign key
    to `users.id`, and (owner_id, name) is unique. The list owns its items;
    unlike the other ORM models, this is the first aggregate with children,
    so it uses a `relationship()` (eager `selectin` load, cascade delete) to
    materialize `book_ids` in a single query. `version` backs SQLAlchemy's
    native optimistic locking (`version_id_col`); see the repository's
    `save()` for how item-only changes are made to bump it too.
    """

    __tablename__ = "favourite_lists"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_favourite_lists_owner_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    version: Mapped[int] = mapped_column(nullable=False, default=1)

    items: Mapped[list["FavouriteListItemORM"]] = relationship(
        back_populates="favourite_list",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="FavouriteListItemORM.id",
    )

    __mapper_args__ = {"version_id_col": version}


class FavouriteListItemORM(Base):
    """ORM mapping for the `favourite_list_items` table.

    Join row linking a favourite list to a catalog book. `list_id` cascades on
    delete so removing a list drops its items; (list_id, book_id) is unique.
    """

    __tablename__ = "favourite_list_items"
    __table_args__ = (
        UniqueConstraint("list_id", "book_id", name="uq_favourite_list_items_list_book"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(
        ForeignKey("favourite_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    book_id: Mapped[int] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True
    )

    favourite_list: Mapped["FavouriteListORM"] = relationship(back_populates="items")
