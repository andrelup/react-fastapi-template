"""API tests for the /tags endpoints: role-only authorization over HTTP.

Like `/collections`, there is no ownership here — reading is open to every
authenticated role, and `POST /tags` requires at least EDITOR. `authenticated_as`
overrides `get_current_user`, so the status codes are asserted without minting
real JWTs, and since tags carry no foreign key to `users`, none of these tests
need a real user row, unlike `test_item_endpoints.py`.
"""

from collections.abc import Callable

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.example.tag_repository import SqlAlchemyTagRepository
from src.domain.models.example.tag import Tag
from src.domain.models.user import User, UserRole


async def _a_tag(db_session: AsyncSession, name: str = "onboarding") -> Tag:
    """Insert a tag, bypassing the API."""
    tag, _ = await SqlAlchemyTagRepository(db_session).get_or_create(name)
    return tag


def _user(user_id: int, role: UserRole) -> User:
    return User(
        id=user_id,
        email=f"user{user_id}@example.com",
        name=f"User {user_id}",
        role=role,
        hashed_password="hashed:pw",
    )


# --- authentication -------------------------------------------------------


async def test_search_tags_without_credentials_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.get("/tags")

    # Assert
    assert response.status_code == 401
    assert response.json()["success"] is False


async def test_ensure_tag_exists_without_credentials_returns_401(
    async_client: AsyncClient,
) -> None:
    # Act
    response = await async_client.post("/tags", json={"name": "onboarding"})

    # Assert
    assert response.status_code == 401


# --- GET /tags: every authenticated role -------------------------------------


async def test_search_tags_as_viewer_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    await _a_tag(db_session, "listado-viewer")
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get("/tags")

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True
    assert any(tag["name"] == "listado-viewer" for tag in body["data"]["tags"])


async def test_search_tags_as_editor_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.get("/tags")

    # Assert
    assert response.status_code == 200


async def test_search_tags_with_an_empty_query_returns_up_to_50_ordered_by_name(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    for name in ["zulu-empty-q", "alfa-empty-q"]:
        await _a_tag(db_session, name)
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get("/tags")

    # Assert
    names = [tag["name"] for tag in response.json()["data"]["tags"]]
    assert names == sorted(names)
    assert len(names) <= 50


async def test_search_tags_with_q_returns_only_the_matches_including_orphans(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — a tag with no item attached still surfaces, per issue #62
    await _a_tag(db_session, "sin-items-buscable")
    await _a_tag(db_session, "otra-completamente-distinta")
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get("/tags", params={"q": "sin-items"})

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert [tag["name"] for tag in body["data"]["tags"]] == ["sin-items-buscable"]


async def test_search_tags_with_a_query_over_50_characters_returns_422(
    async_client: AsyncClient, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — the column is `String(50)`, so the query parameter matches it
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get("/tags", params={"q": "x" * 51})

    # Assert
    assert response.status_code == 422


# --- POST /tags: EDITOR minimum, 200-or-201 idempotence ----------------------


async def test_ensure_tag_exists_as_viewer_returns_403(
    async_client: AsyncClient, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.post("/tags", json={"name": "no-puede-el-viewer"})

    # Assert
    assert response.status_code == 403
    assert response.json()["success"] is False


async def test_ensure_tag_exists_as_editor_with_a_new_name_returns_201(
    async_client: AsyncClient, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.post("/tags", json={"name": "nueva-desde-api"})

    # Assert
    body = response.json()
    assert response.status_code == 201
    assert body["success"] is True
    assert body["data"]["name"] == "nueva-desde-api"
    assert body["data"]["id"] is not None


async def test_ensure_tag_exists_as_admin_is_allowed(
    async_client: AsyncClient, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.post("/tags", json={"name": "creada-por-admin"})

    # Assert
    assert response.status_code == 201


async def test_ensure_tag_exists_repeated_returns_200_and_the_same_id(
    async_client: AsyncClient, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.EDITOR))
    first = await async_client.post("/tags", json={"name": "idempotente"})
    assert first.status_code == 201
    first_id = first.json()["data"]["id"]

    # Act — the same call again
    second = await async_client.post("/tags", json={"name": "idempotente"})

    # Assert — 200, not 201, and the same id: no duplicate, no failure
    body = second.json()
    assert second.status_code == 200
    assert body["data"]["id"] == first_id


async def test_ensure_tag_exists_with_a_name_over_50_characters_returns_422(
    async_client: AsyncClient, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.post("/tags", json={"name": "x" * 51})

    # Assert
    assert response.status_code == 422
