"""create initial schema

Revision ID: d5d3e24a6992
Revises:
Create Date: 2026-09-10 13:32:54.872797

Single initial revision. It replaces the four revisions of the bookstore
template (users -> books -> favourite lists -> version columns), which were
dropped along with that example domain: their tables no longer had ORM models,
so autogenerate wanted to drop them again on the next run.

Creates the template's own `users` table plus the neutral example catalogue:
`items` (owned by a user), `collections`, `tags`, and the `item_tags` /
`item_collections` association tables. Every foreign key is named following
`fk_<table>_<column>_<ref_table>` and cascades on delete, so removing a user
removes their items and removing an item removes its links; `items` and
`collections` carry the `version` column backing SQLAlchemy's `version_id_col`
optimistic locking.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5d3e24a6992"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "collections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_collections_name"),
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tags_name"), "tags", ["name"], unique=True)

    op.create_table(
        "items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name="fk_items_owner_id_users", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_items_category"), "items", ["category"], unique=False)
    op.create_index(op.f("ix_items_owner_id"), "items", ["owner_id"], unique=False)
    op.create_index(op.f("ix_items_slug"), "items", ["slug"], unique=True)

    # Association tables: no surrogate key, the two foreign keys are the primary
    # key. Only the trailing column gets its own index -- the leading one is
    # already covered by the composite primary key index.
    op.create_table(
        "item_tags",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name="fk_item_tags_item_id_items", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"], ["tags.id"], name="fk_item_tags_tag_id_tags", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("item_id", "tag_id"),
    )
    op.create_index(op.f("ix_item_tags_tag_id"), "item_tags", ["tag_id"], unique=False)

    op.create_table(
        "item_collections",
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["item_id"], ["items.id"], name="fk_item_collections_item_id_items", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["collection_id"],
            ["collections.id"],
            name="fk_item_collections_collection_id_collections",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("item_id", "collection_id"),
    )
    op.create_index(
        op.f("ix_item_collections_collection_id"),
        "item_collections",
        ["collection_id"],
        unique=False,
    )


def downgrade() -> None:
    # Reverse dependency order: association tables, then the entities they link,
    # and `users` last because `items.owner_id` points at it.
    op.drop_index(op.f("ix_item_collections_collection_id"), table_name="item_collections")
    op.drop_table("item_collections")
    op.drop_index(op.f("ix_item_tags_tag_id"), table_name="item_tags")
    op.drop_table("item_tags")

    op.drop_index(op.f("ix_items_slug"), table_name="items")
    op.drop_index(op.f("ix_items_owner_id"), table_name="items")
    op.drop_index(op.f("ix_items_category"), table_name="items")
    op.drop_table("items")

    op.drop_index(op.f("ix_tags_name"), table_name="tags")
    op.drop_table("tags")
    op.drop_table("collections")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
