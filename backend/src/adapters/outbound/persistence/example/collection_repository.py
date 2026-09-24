"""SQLAlchemy implementation of the `CollectionRepository` port."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.adapters.outbound.persistence.example.collection import CollectionORM
from src.domain.models.example.collection import Collection


def _to_domain(collection_orm: CollectionORM) -> Collection:
    """Map a `CollectionORM` row to the framework-agnostic `Collection` domain model."""
    return Collection(
        id=collection_orm.id,
        name=collection_orm.name,
        description=collection_orm.description,
        version=collection_orm.version,
    )


def _apply_fields(collection_orm: CollectionORM, collection: Collection) -> None:
    """Copy the mutable scalar fields of `collection` onto `collection_orm`."""
    collection_orm.name = collection.name
    collection_orm.description = collection.description


class SqlAlchemyCollectionRepository:
    """Implements `CollectionRepository` (see `domain/ports/example/repositories.py`).

    Structural typing: this class deliberately does not inherit from the
    Protocol it satisfies.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, collection_id: int) -> Collection | None:
        collection_orm = await self._session.get(CollectionORM, collection_id)
        return _to_domain(collection_orm) if collection_orm is not None else None

    async def find_all(self, page: int, page_size: int) -> tuple[list[Collection], int]:
        offset = (page - 1) * page_size
        total = (
            await self._session.execute(select(func.count()).select_from(CollectionORM))
        ).scalar_one()
        result = await self._session.execute(
            select(CollectionORM).order_by(CollectionORM.name).offset(offset).limit(page_size)
        )
        return [_to_domain(collection_orm) for collection_orm in result.scalars().all()], total

    async def find_by_ids(self, ids: list[int]) -> list[Collection]:
        result = await self._session.execute(select(CollectionORM).where(CollectionORM.id.in_(ids)))
        return [_to_domain(collection_orm) for collection_orm in result.scalars().all()]

    async def find_by_name(self, name: str) -> Collection | None:
        result = await self._session.execute(
            select(CollectionORM).where(CollectionORM.name == name)
        )
        collection_orm = result.scalar_one_or_none()
        return _to_domain(collection_orm) if collection_orm is not None else None

    async def save(self, collection: Collection) -> Collection:
        if collection.id is None:
            collection_orm = CollectionORM(
                name=collection.name,
                description=collection.description,
            )
            self._session.add(collection_orm)
        else:
            existing_collection_orm = await self._session.get(CollectionORM, collection.id)
            if existing_collection_orm is None:
                raise ValueError(f"Cannot update collection {collection.id}: it does not exist")
            # Load-bearing: see the note in `SqlAlchemyItemRepository.save`.
            # `session.get()` re-reads the row, so without overwriting it here
            # the UPDATE's `WHERE version = :v` would always match whatever
            # version is already in the database instead of the one the
            # caller read, and `StaleDataError` would never fire.
            attributes.set_committed_value(existing_collection_orm, "version", collection.version)
            _apply_fields(existing_collection_orm, collection)
            collection_orm = existing_collection_orm

        await self._session.commit()
        await self._session.refresh(collection_orm)
        return _to_domain(collection_orm)

    async def delete(self, collection_id: int) -> None:
        collection_orm = await self._session.get(CollectionORM, collection_id)
        if collection_orm is not None:
            await self._session.delete(collection_orm)
            await self._session.commit()
