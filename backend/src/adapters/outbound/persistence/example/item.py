"""`items` table — the hub of the neutral example catalogue.

`items` points at `users` with a plain foreign key and no relationship: the
dependency has to run one way only, or `UserORM` (template code) would end up
referencing the example domain and the package would stop being deletable on
its own.
"""

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.adapters.outbound.persistence.example.collection import item_collections_table
from src.adapters.outbound.persistence.example.tag import item_tags_table
from src.adapters.outbound.persistence.sqlalchemy_models import Base

if TYPE_CHECKING:
    from src.adapters.outbound.persistence.example.collection import CollectionORM
    from src.adapters.outbound.persistence.example.tag import TagORM


class ItemORM(Base):
    """`items` table, with optimistic locking."""

    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Plain `String`, never `sa.Enum`: any conversion to a domain enum belongs
    # in the repository's mapper, as `UserORM.role` already does.
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", name="fk_items_owner_id_users"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(nullable=False, default=1)

    # `lazy="selectin"` because a lazy load inside async code raises at runtime,
    # and an explicit `order_by` so the collections come back deterministically.
    #
    # Careful, these are mutual: SQLAlchemy stops the eager load after one hop,
    # so the `TagORM.items` / `CollectionORM.items` reached from here come back
    # *unloaded*, and touching them falls back to a lazy load -> `MissingGreenlet`
    # under asyncio. A mapper may read scalar columns off the far side
    # (`tag.name`, `collection.name`) but never its reverse collection.
    tags: Mapped[list["TagORM"]] = relationship(
        secondary=item_tags_table,
        back_populates="items",
        lazy="selectin",
        order_by="TagORM.name",
    )
    collections: Mapped[list["CollectionORM"]] = relationship(
        secondary=item_collections_table,
        back_populates="items",
        lazy="selectin",
        order_by="CollectionORM.name",
    )

    __mapper_args__ = {"version_id_col": version}
