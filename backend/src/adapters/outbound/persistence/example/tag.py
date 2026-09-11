"""`tags` table and the `item_tags` association table.

The association table lives here, next to the entity it hangs off an item, so
that everything tag-shaped is in one module. It is a bare `Table` rather than a
mapped class on purpose: it carries no columns of its own beyond the two
foreign keys that form its primary key, so a class would be noise.
"""

from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.adapters.outbound.persistence.sqlalchemy_models import Base

if TYPE_CHECKING:
    from src.adapters.outbound.persistence.example.item import ItemORM


item_tags_table = Table(
    "item_tags",
    Base.metadata,
    Column(
        "item_id",
        Integer,
        ForeignKey("items.id", ondelete="CASCADE", name="fk_item_tags_item_id_items"),
        primary_key=True,
    ),
    # `item_id` is already covered by the leading edge of the composite primary
    # key index; `tag_id` needs its own so the FK's ON DELETE CASCADE and the
    # reverse lookup do not fall back to a sequential scan.
    Column(
        "tag_id",
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE", name="fk_item_tags_tag_id_tags"),
        primary_key=True,
        index=True,
    ),
)


class TagORM(Base):
    """`tags` table."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    # No `cascade="all, delete-orphan"` on a `secondary` relationship: it would
    # delete the item itself instead of the association row. Cleaning up the
    # link rows is the foreign key's `ondelete="CASCADE"` job.
    items: Mapped[list["ItemORM"]] = relationship(
        secondary=item_tags_table,
        back_populates="tags",
        lazy="selectin",
        order_by="ItemORM.id",
    )
