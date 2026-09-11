"""Unit tests for the ORM conventions of the neutral example catalogue.

No database and no session: these read `Base.metadata` and the mappers only.
Importing the `example` package is what registers `items`, `collections`,
`tags` and the two association tables, exactly as `alembic/env.py` does before
autogenerate runs.

They are the regression guard for the rules in
`docs/backend-database-sqlalchemy.md`: explicitly named foreign keys that
cascade, an index on every foreign key column, a length on every `String`, no
`sa.Enum`, and `version_id_col` only on the aggregates that need it.
"""

from typing import Any

from sqlalchemy import Column, Enum, String, Table, Text, UniqueConstraint
from src.adapters.outbound.persistence.example import CollectionORM, ItemORM, TagORM
from src.adapters.outbound.persistence.sqlalchemy_models import Base, UserORM

CATALOGUE_TABLES = ("items", "collections", "tags", "item_tags", "item_collections")


def _table(name: str) -> Table:
    return Base.metadata.tables[name]


def _all_columns() -> list[tuple[Table, Column[Any]]]:
    return [(table, column) for table in Base.metadata.tables.values() for column in table.columns]


def _all_foreign_keys() -> list[tuple[Table, Any]]:
    return [
        (table, constraint)
        for table in Base.metadata.tables.values()
        for constraint in table.foreign_key_constraints
    ]


def _indexed_column_names(table: Table) -> set[str]:
    """Columns a lookup can use an index for: the leading column of an index or of the PK."""
    leading = {list(index.columns)[0].name for index in table.indexes}
    primary_key_columns = list(table.primary_key.columns)
    if primary_key_columns:
        leading.add(primary_key_columns[0].name)
    return leading


def test_base_metadata_registers_exactly_the_template_and_catalogue_tables() -> None:
    # Arrange
    # Deliberately exhaustive rather than a subset check: the previous example
    # domain's revisions once outlived the ORM models they described, and
    # equality is what catches a stale or orphaned table next time.
    expected = {"users", *CATALOGUE_TABLES}

    # Act
    registered = set(Base.metadata.tables)

    # Assert
    assert registered == expected


def test_every_foreign_key_is_explicitly_named() -> None:
    # Arrange
    expected = {
        "fk_items_owner_id_users",
        "fk_item_tags_item_id_items",
        "fk_item_tags_tag_id_tags",
        "fk_item_collections_item_id_items",
        "fk_item_collections_collection_id_collections",
    }

    # Act
    names = {constraint.name for _, constraint in _all_foreign_keys()}

    # Assert
    assert names == expected


def test_every_foreign_key_name_derives_from_its_table_column_and_target() -> None:
    # Arrange
    foreign_keys = _all_foreign_keys()

    # Act / Assert
    assert foreign_keys, "no foreign keys found: the loop below would pass vacuously"
    for table, constraint in foreign_keys:
        column_name = list(constraint.columns)[0].name
        expected = f"fk_{table.name}_{column_name}_{constraint.referred_table.name}"
        assert constraint.name == expected


def test_every_foreign_key_cascades_on_delete() -> None:
    # Arrange
    foreign_keys = _all_foreign_keys()

    # Act
    without_cascade = [
        constraint.name for _, constraint in foreign_keys if constraint.ondelete != "CASCADE"
    ]

    # Assert
    assert without_cascade == []


def test_every_foreign_key_column_is_indexed() -> None:
    # Arrange
    foreign_keys = _all_foreign_keys()

    # Act
    unindexed = [
        constraint.name
        for table, constraint in foreign_keys
        if list(constraint.columns)[0].name not in _indexed_column_names(table)
    ]

    # Assert
    assert unindexed == []


def test_the_catalogue_declares_the_expected_indexes() -> None:
    # Arrange
    expected = {
        "items": {"ix_items_slug", "ix_items_category", "ix_items_owner_id"},
        "collections": set[str](),
        "tags": {"ix_tags_name"},
        # The leading key column rides the composite primary key index; only the
        # trailing one needs an index of its own.
        "item_tags": {"ix_item_tags_tag_id"},
        "item_collections": {"ix_item_collections_collection_id"},
    }

    # Act
    declared = {name: {index.name for index in _table(name).indexes} for name in CATALOGUE_TABLES}

    # Assert
    assert declared == expected


def test_association_tables_are_keyed_by_their_two_foreign_keys() -> None:
    # Arrange / Act
    item_tags_key = [column.name for column in _table("item_tags").primary_key.columns]
    item_collections_key = [
        column.name for column in _table("item_collections").primary_key.columns
    ]

    # Assert
    assert item_tags_key == ["item_id", "tag_id"]
    assert item_collections_key == ["item_id", "collection_id"]


def test_item_slug_and_tag_name_are_unique_indexes() -> None:
    # Arrange / Act
    unique_indexes = {
        index.name for name in CATALOGUE_TABLES for index in _table(name).indexes if index.unique
    }

    # Assert
    assert unique_indexes == {"ix_items_slug", "ix_tags_name"}


def test_collection_name_is_protected_by_a_named_unique_constraint() -> None:
    # Arrange / Act
    unique_constraints = {
        constraint.name: [column.name for column in constraint.columns]
        for constraint in _table("collections").constraints
        if isinstance(constraint, UniqueConstraint)
    }

    # Assert
    assert unique_constraints == {"uq_collections_name": ["name"]}


def test_every_string_column_declares_a_length() -> None:
    # Arrange
    # `Text` subclasses `String` and is the sanctioned way to store free text
    # without a length, so it is excluded on purpose.
    string_columns = [
        (f"{table.name}.{column.name}", column.type.length)
        for table, column in _all_columns()
        if isinstance(column.type, String) and not isinstance(column.type, Text)
    ]

    # Act
    without_length = [name for name, length in string_columns if length is None]

    # Assert
    assert string_columns, "no String columns found: the check below would pass vacuously"
    assert without_length == []


def test_no_column_maps_to_a_database_enum() -> None:
    # Arrange / Act
    # `users.role` and `items.category` are plain strings; converting them to a
    # domain enum is the repository mapper's job.
    enum_columns = [
        f"{table.name}.{column.name}"
        for table, column in _all_columns()
        if isinstance(column.type, Enum)
    ]

    # Assert
    assert enum_columns == []


def test_item_and_collection_carry_optimistic_locking() -> None:
    # Arrange / Act
    item_version_column = ItemORM.__mapper__.version_id_col
    collection_version_column = CollectionORM.__mapper__.version_id_col

    # Assert
    assert item_version_column is _table("items").c["version"]
    assert collection_version_column is _table("collections").c["version"]


def test_tag_and_user_do_not_carry_optimistic_locking() -> None:
    # Arrange / Act / Assert
    assert TagORM.__mapper__.version_id_col is None
    assert UserORM.__mapper__.version_id_col is None


def test_many_to_many_relationships_load_eagerly_and_never_cascade_deletes() -> None:
    # Arrange
    many_to_many = [
        ItemORM.__mapper__.relationships["tags"],
        ItemORM.__mapper__.relationships["collections"],
        TagORM.__mapper__.relationships["items"],
        CollectionORM.__mapper__.relationships["items"],
    ]

    # Act / Assert
    for relationship_property in many_to_many:
        # A lazy load inside async code raises at runtime, hence `selectin`.
        assert relationship_property.secondary is not None
        assert relationship_property.lazy == "selectin"
        # `delete-orphan` on a `secondary` relationship would delete the target
        # row instead of the association row; the FK ON DELETE CASCADE does that.
        assert relationship_property.cascade.delete_orphan is False
        assert relationship_property.back_populates is not None
        assert relationship_property.order_by is not None
