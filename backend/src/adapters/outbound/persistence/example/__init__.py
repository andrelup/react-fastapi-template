"""ORM models for the neutral example catalogue (`items`, `collections`, `tags`).

Everything the example domain persists lives in this package, and nothing
outside it references these classes: `sqlalchemy_models.py` keeps only `Base`
and `UserORM`, which belong to the template itself. Removing the sample
catalogue from a generated project is therefore a `rm -rf` of this directory
plus the single marked import in `alembic/env.py` (issue #14, `--no-example`).

Importing this package is what registers the tables on `Base.metadata`, which
is what Alembic autogenerate compares the database against.
"""

from src.adapters.outbound.persistence.example.collection import (
    CollectionORM,
    item_collections_table,
)
from src.adapters.outbound.persistence.example.item import ItemORM
from src.adapters.outbound.persistence.example.tag import TagORM, item_tags_table

__all__ = [
    "CollectionORM",
    "ItemORM",
    "TagORM",
    "item_collections_table",
    "item_tags_table",
]
