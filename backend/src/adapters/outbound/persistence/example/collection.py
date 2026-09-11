"""`collections` table and the `item_collections` association table.

Same split as `tag.py`: the association table sits next to the entity it hangs
off an item, and is a bare `Table` because it owns no columns beyond the two
foreign keys forming its primary key.
"""

from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.adapters.outbound.persistence.sqlalchemy_models import Base

if TYPE_CHECKING:
    from src.adapters.outbound.persistence.example.item import ItemORM


item_collections_table = Table(
    "item_collections",
    Base.metadata,
    Column(
        "item_id",
        Integer,
        ForeignKey("items.id", ondelete="CASCADE", name="fk_item_collections_item_id_items"),
        primary_key=True,
    ),
    # See `item_tags_table`: the trailing key column gets an explicit index, the
    # leading one rides the composite primary key.
    Column(
        "collection_id",
        Integer,
        ForeignKey(
            "collections.id",
            ondelete="CASCADE",
            name="fk_item_collections_collection_id_collections",
        ),
        primary_key=True,
        index=True,
    ),
)


class CollectionORM(Base):
    """`collections` table, with optimistic locking."""

    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(nullable=False, default=1)

    # No `cascade="all, delete-orphan"` on a `secondary` relationship: it would
    # delete the item itself instead of the association row.
    items: Mapped[list["ItemORM"]] = relationship(
        secondary=item_collections_table,
        back_populates="collections",
        lazy="selectin",
        order_by="ItemORM.id",
    )

    __table_args__ = (UniqueConstraint("name", name="uq_collections_name"),)
    __mapper_args__ = {"version_id_col": version}
