"""add version columns for optimistic locking

Revision ID: f16ee8143e9d
Revises: 40dad4404cae
Create Date: 2026-07-09 15:20:39.451852

Adds a `version` column to `books` and `favourite_lists`, backing
SQLAlchemy's native `version_id_col` optimistic locking (see
`sqlalchemy_models.py`): every UPDATE checks the in-memory version against
the row's current value and increments it, so a stale concurrent write
raises `StaleDataError` (translated to HTTP 409) instead of silently
overwriting another request's change. `server_default="1"` backfills
existing rows so the column can be `NOT NULL` from the start.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f16ee8143e9d"
down_revision: str | None = "40dad4404cae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("books", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column(
        "favourite_lists", sa.Column("version", sa.Integer(), nullable=False, server_default="1")
    )


def downgrade() -> None:
    op.drop_column("favourite_lists", "version")
    op.drop_column("books", "version")
