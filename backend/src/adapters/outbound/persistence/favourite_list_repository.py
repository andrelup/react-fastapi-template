"""SQLAlchemy implementation of the `FavouriteListRepository` port."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.adapters.outbound.persistence.sqlalchemy_models import (
    FavouriteListItemORM,
    FavouriteListORM,
)
from src.domain.models.favourite import FavouriteList


def _to_domain(list_orm: FavouriteListORM) -> FavouriteList:
    return FavouriteList(
        id=list_orm.id,
        owner_id=list_orm.owner_id,
        name=list_orm.name,
        book_ids=[item.book_id for item in list_orm.items],
        version=list_orm.version,
    )


def _reconcile_items(list_orm: FavouriteListORM, book_ids: list[int]) -> None:
    """Make `list_orm.items` match `book_ids`, preserving existing rows."""
    desired = list(dict.fromkeys(book_ids))
    current = {item.book_id: item for item in list_orm.items}
    for book_id, item in current.items():
        if book_id not in desired:
            list_orm.items.remove(item)
    for book_id in desired:
        if book_id not in current:
            list_orm.items.append(FavouriteListItemORM(book_id=book_id))


class SqlAlchemyFavouriteListRepository:
    """Implements the `FavouriteListRepository` port using an async SQLAlchemy session."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, list_id: int) -> FavouriteList | None:
        list_orm = await self._session.get(FavouriteListORM, list_id)
        return _to_domain(list_orm) if list_orm is not None else None

    async def find_all_by_owner(self, owner_id: int) -> list[FavouriteList]:
        stmt = (
            select(FavouriteListORM)
            .where(FavouriteListORM.owner_id == owner_id)
            .order_by(FavouriteListORM.id)
        )
        result = await self._session.execute(stmt)
        return [_to_domain(row) for row in result.scalars().all()]

    async def find_by_owner_and_name(self, owner_id: int, name: str) -> FavouriteList | None:
        stmt = select(FavouriteListORM).where(
            FavouriteListORM.owner_id == owner_id,
            FavouriteListORM.name == name,
        )
        result = await self._session.execute(stmt)
        list_orm = result.scalars().first()
        return _to_domain(list_orm) if list_orm is not None else None

    async def save(self, favourite_list: FavouriteList) -> FavouriteList:
        if favourite_list.id is not None:
            list_orm = await self._session.get(FavouriteListORM, favourite_list.id)
            if list_orm is None:
                raise ValueError(f"Favourite list {favourite_list.id} not found for update")
            # Assert the caller's loaded version, not the row's freshly-read
            # one: `find_by_id` returns a detached domain object and discards
            # the ORM, so this `get()` re-reads the current row (the identity
            # map holds instances weakly). Overriding the committed version
            # with what the caller loaded makes `version_id_col` emit
            # `WHERE version = <loaded>`, so a stale write raises
            # `StaleDataError` instead of silently clobbering a concurrent one.
            attributes.set_committed_value(list_orm, "version", favourite_list.version)
            list_orm.name = favourite_list.name
            _reconcile_items(list_orm, favourite_list.book_ids)
            # `version_id_col` only bumps on an UPDATE emitted against this row.
            # Adding/removing items only emits INSERT/DELETE on
            # `favourite_list_items`, which never touches `favourite_lists` —
            # so an item-only change wouldn't otherwise trigger the version
            # check. Flagging `name` as modified (even when unchanged) forces
            # SQLAlchemy to emit an UPDATE on the parent row too.
            attributes.flag_modified(list_orm, "name")
        else:
            list_orm = FavouriteListORM(
                owner_id=favourite_list.owner_id,
                name=favourite_list.name,
                items=[
                    FavouriteListItemORM(book_id=book_id)
                    for book_id in dict.fromkeys(favourite_list.book_ids)
                ],
            )
            self._session.add(list_orm)

        await self._session.commit()
        await self._session.refresh(list_orm)
        return _to_domain(list_orm)

    async def delete(self, list_id: int) -> None:
        list_orm = await self._session.get(FavouriteListORM, list_id)
        if list_orm is not None:
            await self._session.delete(list_orm)
            await self._session.commit()
