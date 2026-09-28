"""SQLAlchemy implementation of the `TagRepository` port."""

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapters.outbound.persistence.example.tag import TagORM
from src.domain.models.example.tag import Tag


def _to_domain(tag_orm: TagORM) -> Tag:
    """Map a `TagORM` row to the framework-agnostic `Tag` domain model."""
    return Tag(id=tag_orm.id, name=tag_orm.name)


class SqlAlchemyTagRepository:
    """Implements `TagRepository` (see `domain/ports/example/repositories.py`).

    Structural typing: this class deliberately does not inherit from the
    Protocol it satisfies.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(self, query: str | None, limit: int) -> list[Tag]:
        statement = select(TagORM)
        if query:
            # A plain `ILIKE '%...%'`, never a full-text index — per the
            # backend CLAUDE.md and confirmed against this table's real data:
            # even the prefix form `ILIKE 'foo%'` is a sequential scan here,
            # because `ix_tags_name` is a default-collation btree and `ILIKE`
            # compiles to the `~~*` operator, which that opclass does not
            # support at all. A vocabulary in the tens-to-low-thousands is a
            # handful of fully cached pages, and the result is capped at
            # `limit` rows, so the scan is the right answer, not a shortcut.
            statement = statement.where(TagORM.name.ilike(f"%{query}%"))
        statement = statement.order_by(TagORM.name).limit(limit)
        result = await self._session.execute(statement)
        return [_to_domain(tag_orm) for tag_orm in result.scalars().all()]

    async def get_or_create(self, name: str) -> tuple[Tag, bool]:
        """Return the tag named `name`, creating it if it does not exist yet.

        Deliberately wrapped in `try/except IntegrityError`, unlike
        `SqlAlchemyItemRepository._get_or_create_tag` (which documents in its
        own docstring why it lets the same race reach the error handler as a
        409). That method resolves a tag as a side effect of saving an item,
        where a conflict is meaningful feedback about the item. This method
        *is* the whole operation: `POST /tags` promises to be idempotent, so
        a caller racing another one to the same brand-new name must still get
        back 200 and the row that won, not a 409 for a tag that, from the
        caller's point of view, exists exactly as requested. See issue #62.
        """
        result = await self._session.execute(select(TagORM).where(TagORM.name == name))
        tag_orm = result.scalar_one_or_none()
        if tag_orm is not None:
            return _to_domain(tag_orm), False

        tag_orm = TagORM(name=name)
        self._session.add(tag_orm)
        try:
            await self._session.commit()
        except IntegrityError:
            # The unique constraint and the SELECT above are not the same
            # mechanism: the constraint only tells us we lost the race, it
            # does not hand back the winning row, and it leaves the session's
            # transaction unusable until it is rolled back.
            await self._session.rollback()
            result = await self._session.execute(select(TagORM).where(TagORM.name == name))
            tag_orm = result.scalar_one_or_none()
            if tag_orm is None:
                # The INSERT can only fail on `tags.name UNIQUE`, which means
                # a row with this exact name now exists — if it is not found
                # here, something other than the race we just handled is
                # wrong, and pretending otherwise would hide it.
                raise RuntimeError(
                    f"Tag {name!r} lost a unique-constraint race but no row "
                    "with that name was found on re-read"
                ) from None
            return _to_domain(tag_orm), False

        await self._session.refresh(tag_orm)
        return _to_domain(tag_orm), True
