"""SQLAlchemy implementation of the `UserRepository` port."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.adapters.outbound.persistence.sqlalchemy_models import UserORM
from src.domain.models.user import User, UserRole


def _to_domain(user_orm: UserORM) -> User:
    """Map a `UserORM` row to the framework-agnostic `User` domain model."""
    return User(
        id=user_orm.id,
        email=user_orm.email,
        name=user_orm.name,
        role=UserRole(user_orm.role),
        hashed_password=user_orm.hashed_password,
    )


class SqlAlchemyUserRepository:
    """Implements `UserRepository` (see `domain/ports/repositories.py`) with SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, user_id: int) -> User | None:
        user_orm = await self._session.get(UserORM, user_id)
        return _to_domain(user_orm) if user_orm is not None else None

    async def find_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(UserORM).where(UserORM.email == email))
        user_orm = result.scalar_one_or_none()
        return _to_domain(user_orm) if user_orm is not None else None

    async def save(self, user: User) -> User:
        if user.id is None:
            user_orm = UserORM(
                email=user.email,
                name=user.name,
                role=user.role.value,
                hashed_password=user.hashed_password,
            )
            self._session.add(user_orm)
        else:
            existing_user_orm = await self._session.get(UserORM, user.id)
            if existing_user_orm is None:
                raise ValueError(f"Cannot update user {user.id}: it does not exist")
            existing_user_orm.email = user.email
            existing_user_orm.name = user.name
            existing_user_orm.role = user.role.value
            existing_user_orm.hashed_password = user.hashed_password
            user_orm = existing_user_orm

        await self._session.commit()
        await self._session.refresh(user_orm)
        return _to_domain(user_orm)
