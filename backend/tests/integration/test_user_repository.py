"""Integration tests for SqlAlchemyUserRepository, against a real Postgres DB.

Each test runs inside a transaction rolled back by the `db_session`
fixture, so no data is left behind between runs.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.domain.models.user import User, UserRole


async def test_save_inserts_a_new_user_and_assigns_an_id(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyUserRepository(db_session)
    new_user = User(
        email="alice@example.com",
        name="Alice",
        role=UserRole.CUSTOMER,
        hashed_password="hashed:pw",
    )

    # Act
    saved_user = await sut.save(new_user)

    # Assert
    assert saved_user.id is not None
    assert saved_user.email == "alice@example.com"
    assert saved_user.role == UserRole.CUSTOMER


async def test_find_by_email_returns_the_matching_user(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyUserRepository(db_session)
    await sut.save(
        User(
            email="bob@example.com",
            name="Bob",
            role=UserRole.SELLER,
            hashed_password="hashed:pw",
        )
    )

    # Act
    found_user = await sut.find_by_email("bob@example.com")

    # Assert
    assert found_user is not None
    assert found_user.name == "Bob"
    assert found_user.role == UserRole.SELLER


async def test_find_by_email_when_not_found_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyUserRepository(db_session)

    # Act
    found_user = await sut.find_by_email("does-not-exist@example.com")

    # Assert
    assert found_user is None


async def test_find_by_id_returns_the_matching_user(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyUserRepository(db_session)
    saved_user = await sut.save(
        User(
            email="carol@example.com",
            name="Carol",
            role=UserRole.CUSTOMER,
            hashed_password="hashed:pw",
        )
    )
    assert saved_user.id is not None

    # Act
    found_user = await sut.find_by_id(saved_user.id)

    # Assert
    assert found_user is not None
    assert found_user.email == "carol@example.com"


async def test_find_by_id_when_not_found_returns_none(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyUserRepository(db_session)

    # Act
    found_user = await sut.find_by_id(999_999)

    # Assert
    assert found_user is None


async def test_save_with_existing_id_updates_the_user(db_session: AsyncSession) -> None:
    # Arrange
    sut = SqlAlchemyUserRepository(db_session)
    saved_user = await sut.save(
        User(
            email="dave@example.com",
            name="Dave",
            role=UserRole.CUSTOMER,
            hashed_password="hashed:old-pw",
        )
    )
    assert saved_user.id is not None
    updated_user = User(
        id=saved_user.id,
        email="dave@example.com",
        name="Dave Updated",
        role=UserRole.SELLER,
        hashed_password="hashed:new-pw",
    )

    # Act
    result = await sut.save(updated_user)

    # Assert
    assert result.id == saved_user.id
    assert result.name == "Dave Updated"
    assert result.role == UserRole.SELLER
    assert result.hashed_password == "hashed:new-pw"
