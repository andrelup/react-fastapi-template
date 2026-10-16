"""drop items slug

Revision ID: a3f1c9b2d7e4
Revises: d5d3e24a6992
Create Date: 2026-10-16 10:00:00.000000

The item's slug was never used: the SPA addresses items by id and the API only
looked it up to check uniqueness. Drops the unique index `ix_items_slug` and the
`items.slug` column.

`downgrade` restores the old schema for real: it re-adds the column as nullable,
backfills `item-<id>` (unique by construction, since ids are), then makes it
NOT NULL and recreates the unique index.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3f1c9b2d7e4"
down_revision: str | Sequence[str] | None = "d5d3e24a6992"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Drop the slug's unique index and the column."""
    op.drop_index(op.f("ix_items_slug"), table_name="items")
    op.drop_column("items", "slug")


def downgrade() -> None:
    """Re-add `slug` NOT NULL UNIQUE, backfilling `item-<id>` for existing rows."""
    op.add_column("items", sa.Column("slug", sa.String(length=200), nullable=True))
    op.execute("UPDATE items SET slug = 'item-' || id")
    op.alter_column("items", "slug", existing_type=sa.String(length=200), nullable=False)
    op.create_index(op.f("ix_items_slug"), "items", ["slug"], unique=True)
