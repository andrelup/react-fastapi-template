"""create favourite lists tables

Revision ID: 40dad4404cae
Revises: ef29b2bd937b
Create Date: 2026-07-09 11:49:48.729488

Adds the two tables backing the customer favourite lists aggregate:
`favourite_lists` (one per named list, unique by owner + name) and
`favourite_list_items` (the books in each list, unique by list + book,
cascade-deleted with their parent list). Foreign keys are explicitly named
to match the convention set by the create_books_table migration.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "40dad4404cae"
down_revision: str | None = "ef29b2bd937b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "favourite_lists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name="fk_favourite_lists_owner_id_users"
        ),
        sa.UniqueConstraint("owner_id", "name", name="uq_favourite_lists_owner_name"),
    )
    op.create_index(
        op.f("ix_favourite_lists_owner_id"), "favourite_lists", ["owner_id"], unique=False
    )
    op.create_table(
        "favourite_list_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("list_id", sa.Integer(), nullable=False),
        sa.Column("book_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["list_id"],
            ["favourite_lists.id"],
            name="fk_favourite_list_items_list_id_favourite_lists",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["books.id"],
            name="fk_favourite_list_items_book_id_books",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("list_id", "book_id", name="uq_favourite_list_items_list_book"),
    )
    op.create_index(
        op.f("ix_favourite_list_items_book_id"), "favourite_list_items", ["book_id"], unique=False
    )
    op.create_index(
        op.f("ix_favourite_list_items_list_id"), "favourite_list_items", ["list_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_favourite_list_items_list_id"), table_name="favourite_list_items")
    op.drop_index(op.f("ix_favourite_list_items_book_id"), table_name="favourite_list_items")
    op.drop_table("favourite_list_items")
    op.drop_index(op.f("ix_favourite_lists_owner_id"), table_name="favourite_lists")
    op.drop_table("favourite_lists")
