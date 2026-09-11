"""SQLAlchemy implementation of the `ItemRepository` port."""

from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.adapters.outbound.persistence.example.item import ItemORM
from src.adapters.outbound.persistence.example.tag import TagORM
from src.domain.models.example.item import Item


def _to_domain(item_orm: ItemORM) -> Item:
    """Map an `ItemORM` row to the framework-agnostic `Item` domain model."""
    return Item(
        id=item_orm.id,
        name=item_orm.name,
        slug=item_orm.slug,
        description=item_orm.description,
        category=item_orm.category,
        owner_id=item_orm.owner_id,
        tag_names=[tag.name for tag in item_orm.tags],
        version=item_orm.version,
    )


def _apply_fields(item_orm: ItemORM, item: Item) -> None:
    """Copy the mutable scalar fields of `item` onto `item_orm`."""
    item_orm.name = item.name
    item_orm.slug = item.slug
    item_orm.description = item.description
    item_orm.category = item.category
    item_orm.owner_id = item.owner_id


class SqlAlchemyItemRepository:
    """Implements `ItemRepository` (see `domain/ports/example/repositories.py`).

    Structural typing: this class deliberately does not inherit from the
    Protocol it satisfies.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, item_id: int) -> Item | None:
        item_orm = await self._session.get(ItemORM, item_id)
        return _to_domain(item_orm) if item_orm is not None else None

    async def find_by_slug(self, slug: str) -> Item | None:
        result = await self._session.execute(select(ItemORM).where(ItemORM.slug == slug))
        item_orm = result.scalar_one_or_none()
        return _to_domain(item_orm) if item_orm is not None else None

    async def search(
        self, query: str | None, category: str | None, offset: int, limit: int
    ) -> tuple[list[Item], int]:
        statement = self._filtered(select(ItemORM), query, category)
        total_statement = self._filtered(select(func.count()).select_from(ItemORM), query, category)

        total = (await self._session.execute(total_statement)).scalar_one()
        result = await self._session.execute(
            statement.order_by(ItemORM.name).offset(offset).limit(limit)
        )
        return [_to_domain(item_orm) for item_orm in result.scalars().all()], total

    async def save(self, item: Item) -> Item:
        if item.id is None:
            item_orm = ItemORM(
                name=item.name,
                slug=item.slug,
                description=item.description,
                category=item.category,
                owner_id=item.owner_id,
            )
            self._session.add(item_orm)
        else:
            existing_item_orm = await self._session.get(ItemORM, item.id)
            if existing_item_orm is None:
                raise ValueError(f"Cannot update item {item.id}: it does not exist")
            # Load-bearing. `session.get()` re-reads the row, so the ORM's idea
            # of "the version I loaded" would be whatever is in the database
            # right now instead of what the client read — the UPDATE's
            # `WHERE version = :v` would always match and the lost update this
            # is meant to catch would go through. Overwriting it with the
            # caller's version is what makes `StaleDataError` fire.
            attributes.set_committed_value(existing_item_orm, "version", item.version)
            _apply_fields(existing_item_orm, item)
            item_orm = existing_item_orm

        # `no_autoflush` keeps the whole save in a single flush. Resolving a tag
        # runs a SELECT, and an autoflush there would write the scalar changes
        # as their own UPDATE — bumping the version once — before
        # `flag_modified` below forced a second one, so a plain edit would
        # advance the version by two.
        with self._session.no_autoflush:
            tags_changed = await self._reconcile_tags(item_orm, item.tag_names)
        if item.id is not None and tags_changed:
            # No column on `items` changed when only the links moved, so
            # SQLAlchemy would emit no UPDATE on the parent row and the version
            # would not advance — two clients could retag from the same version
            # and neither would notice. Marking a column dirty forces the
            # UPDATE, and with it the version bump.
            #
            # Only on an update: an INSERT already writes version 1, and
            # flagging the row there would append a gratuitous UPDATE to the
            # same flush, so a brand-new item with tags would come back at
            # version 2.
            attributes.flag_modified(item_orm, "name")
        await self._session.commit()
        await self._session.refresh(item_orm)
        return _to_domain(item_orm)

    async def delete(self, item_id: int) -> None:
        item_orm = await self._session.get(ItemORM, item_id)
        if item_orm is not None:
            await self._session.delete(item_orm)
            await self._session.commit()

    # `tuple[Any, ...]` because this one helper serves both the row query
    # (`Select[tuple[ItemORM]]`) and the count query (`Select[tuple[int]]`).
    # Narrowing it to `tuple[ItemORM]` would break the count call site.
    @staticmethod
    def _filtered(
        statement: Select[tuple[Any, ...]], query: str | None, category: str | None
    ) -> Select[tuple[Any, ...]]:
        if query:
            pattern = f"%{query}%"
            statement = statement.where(
                or_(ItemORM.name.ilike(pattern), ItemORM.description.ilike(pattern))
            )
        if category:
            statement = statement.where(ItemORM.category == category)
        return statement

    async def _reconcile_tags(self, item_orm: ItemORM, tag_names: list[str]) -> bool:
        """Make `item_orm.tags` match `tag_names`, preserving the links that stay.

        Returns whether any link actually moved, which is what tells `save`
        the parent row needs forcing so its version advances.
        """
        desired = set(tag_names)
        current = {tag.name for tag in item_orm.tags}
        if desired == current:
            return False

        for tag in list(item_orm.tags):
            if tag.name not in desired:
                item_orm.tags.remove(tag)
        for name in desired - current:
            item_orm.tags.append(await self._get_or_create_tag(name))
        return True

    async def _get_or_create_tag(self, name: str) -> TagORM:
        """Return the tag with that name, creating it if it does not exist yet.

        Deliberately not wrapped in `try/except IntegrityError`: two concurrent
        saves introducing the same brand-new tag race on `tags.name UNIQUE`, and
        the loser's `IntegrityError` is allowed to reach the error handler,
        which turns it into a 409. Deciding what a conflict means is the
        domain's job, not the repository's.
        """
        result = await self._session.execute(select(TagORM).where(TagORM.name == name))
        tag_orm = result.scalar_one_or_none()
        if tag_orm is None:
            tag_orm = TagORM(name=name)
            self._session.add(tag_orm)
        return tag_orm
