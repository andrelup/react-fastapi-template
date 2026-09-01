"""SQLAlchemy implementation of the `BookRepository` port."""

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from src.adapters.outbound.persistence.sqlalchemy_models import BookORM
from src.domain.models.book import Book


def _to_domain(book_orm: BookORM) -> Book:
    return Book(
        id=book_orm.id,
        title=book_orm.title,
        author=book_orm.author,
        isbn=book_orm.isbn,
        price=float(book_orm.price),
        stock=book_orm.stock,
        seller_id=book_orm.seller_id,
        description=book_orm.description,
        category=book_orm.category,
        version=book_orm.version,
    )


def _apply_fields(book_orm: BookORM, book: Book) -> None:
    book_orm.title = book.title
    book_orm.author = book.author
    book_orm.isbn = book.isbn
    book_orm.price = book.price
    book_orm.stock = book.stock
    book_orm.seller_id = book.seller_id
    book_orm.description = book.description
    book_orm.category = book.category


def _search_filter(query: str) -> ColumnElement[bool]:
    pattern = f"%{query}%"
    return or_(
        BookORM.title.ilike(pattern),
        BookORM.author.ilike(pattern),
        BookORM.category.ilike(pattern),
    )


class SqlAlchemyBookRepository:
    """Implements the `BookRepository` domain port using an async SQLAlchemy session."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, book_id: int) -> Book | None:
        book_orm = await self._session.get(BookORM, book_id)
        return _to_domain(book_orm) if book_orm is not None else None

    async def find_all(self, skip: int, limit: int) -> list[Book]:
        stmt = select(BookORM).order_by(BookORM.id).offset(skip).limit(limit)
        result = await self._session.execute(stmt)
        return [_to_domain(row) for row in result.scalars().all()]

    async def count(self) -> int:
        stmt = select(func.count()).select_from(BookORM)
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def search(self, query: str, skip: int, limit: int) -> list[Book]:
        stmt = (
            select(BookORM)
            .where(_search_filter(query))
            .order_by(BookORM.id)
            .offset(skip)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [_to_domain(row) for row in result.scalars().all()]

    async def count_search(self, query: str) -> int:
        stmt = select(func.count()).select_from(BookORM).where(_search_filter(query))
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def save(self, book: Book) -> Book:
        if book.id is not None:
            book_orm = await self._session.get(BookORM, book.id)
            if book_orm is None:
                raise ValueError(f"Book {book.id} not found for update")
            # Assert the caller's loaded version, not the row's freshly-read
            # one: `find_by_id` returns a detached domain object and discards
            # the ORM, so this `get()` re-reads the current row (the identity
            # map holds instances weakly). Overriding the committed version
            # with what the caller loaded makes `version_id_col` emit
            # `WHERE version = <loaded>`, so a stale write raises
            # `StaleDataError` instead of silently clobbering a concurrent one.
            attributes.set_committed_value(book_orm, "version", book.version)
            _apply_fields(book_orm, book)
        else:
            book_orm = BookORM(
                title=book.title,
                author=book.author,
                isbn=book.isbn,
                price=book.price,
                stock=book.stock,
                seller_id=book.seller_id,
                description=book.description,
                category=book.category,
            )
            self._session.add(book_orm)

        # Persists `book_orm`: flushes an UPDATE for an existing row, or an
        # INSERT for a new one.
        await self._session.commit()
        await self._session.refresh(book_orm)
        return _to_domain(book_orm)

    async def delete(self, book_id: int) -> None:
        book_orm = await self._session.get(BookORM, book_id)
        if book_orm is not None:
            await self._session.delete(book_orm)
            await self._session.commit()
