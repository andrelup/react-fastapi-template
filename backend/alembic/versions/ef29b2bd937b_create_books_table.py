"""create books table

Revision ID: ef29b2bd937b
Revises: e470376bb059
Create Date: 2026-07-08 18:29:02.052979

Reconciled after rebasing onto feature/auth-jwt (issue #6): chained after
e470376bb059 (create users table), and `seller_id` now has a physical
foreign key to `users.id`, since that table exists earlier in history.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ef29b2bd937b"
down_revision: str | None = "e470376bb059"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("isbn", sa.String(length=20), nullable=False),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("seller_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["seller_id"], ["users.id"], name="fk_books_seller_id_users"),
        sa.UniqueConstraint("isbn"),
    )
    op.create_index(op.f("ix_books_author"), "books", ["author"], unique=False)
    op.create_index(op.f("ix_books_category"), "books", ["category"], unique=False)
    op.create_index(op.f("ix_books_seller_id"), "books", ["seller_id"], unique=False)
    op.create_index(op.f("ix_books_title"), "books", ["title"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_books_title"), table_name="books")
    op.drop_index(op.f("ix_books_seller_id"), table_name="books")
    op.drop_index(op.f("ix_books_category"), table_name="books")
    op.drop_index(op.f("ix_books_author"), table_name="books")
    op.drop_table("books")
