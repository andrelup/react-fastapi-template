"""API tests for the /collections endpoints: role-only authorization over HTTP.

Unlike `/items`, there is no ownership here: writing is an ADMIN privilege
across the board, and every authenticated role may read. `authenticated_as`
overrides `get_current_user`, so the status codes are asserted without
minting real JWTs — and since collections carry no foreign key to `users`,
none of these tests need a real user row, unlike `test_item_endpoints.py`.
"""

from collections.abc import Callable

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.example.collection_repository import (
    SqlAlchemyCollectionRepository,
)
from src.domain.models.example.collection import Collection
from src.domain.models.user import User, UserRole


async def _a_collection(db_session: AsyncSession, name: str = "Guias") -> Collection:
    """Insert a collection, bypassing the API."""
    return await SqlAlchemyCollectionRepository(db_session).save(
        Collection(name=name, description="Documentos de bienvenida")
    )


def _payload(name: str = "Nueva coleccion", **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {"name": name, "description": "Creada desde el test"}
    payload.update(overrides)
    return payload


def _user(user_id: int, role: UserRole) -> User:
    return User(
        id=user_id,
        email=f"user{user_id}@example.com",
        name=f"User {user_id}",
        role=role,
        hashed_password="hashed:pw",
    )


# --- authentication -------------------------------------------------------


async def test_list_collections_without_credentials_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.get("/collections")

    # Assert
    assert response.status_code == 401
    assert response.json()["success"] is False


async def test_create_collection_without_credentials_returns_401(
    async_client: AsyncClient,
) -> None:
    # Act
    response = await async_client.post("/collections", json=_payload())

    # Assert
    assert response.status_code == 401


# --- reading: every authenticated role --------------------------------------


async def test_list_collections_as_viewer_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    await _a_collection(db_session, "listado-viewer")
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get("/collections")

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True
    assert body["data"]["page"] == 1
    assert body["data"]["page_size"] == 20
    assert any(collection["name"] == "listado-viewer" for collection in body["data"]["items"])


async def test_list_collections_as_editor_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.get("/collections")

    # Assert
    assert response.status_code == 200


async def test_get_collection_returns_the_collection(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "uno-solo")
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get(f"/collections/{collection.id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "uno-solo"


async def test_get_an_unknown_collection_returns_404(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.get("/collections/987654")

    # Assert
    assert response.status_code == 404
    assert response.json()["success"] is False


# --- creating: ADMIN only ----------------------------------------------------


async def test_create_collection_as_viewer_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.post("/collections", json=_payload())

    # Assert
    assert response.status_code == 403
    assert response.json()["success"] is False


async def test_create_collection_as_editor_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — this is the acceptance criterion: an EDITOR governs its own
    # items' membership but never the collections catalogue itself
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.post("/collections", json=_payload())

    # Assert
    assert response.status_code == 403


async def test_create_collection_as_admin_returns_201(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.post("/collections", json=_payload("creada-por-admin"))

    # Assert
    body = response.json()
    assert response.status_code == 201
    assert body["data"]["name"] == "creada-por-admin"
    assert body["data"]["version"] == 1


async def test_create_collection_with_a_duplicate_name_returns_409(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    await _a_collection(db_session, "ya-existe")
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.post("/collections", json=_payload("ya-existe"))

    # Assert
    assert response.status_code == 409


# --- updating: ADMIN only -----------------------------------------------------


async def test_update_collection_as_viewer_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "del-viewer")
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.put(
        f"/collections/{collection.id}",
        json=_payload("del-viewer", version=collection.version),
    )

    # Assert
    assert response.status_code == 403


async def test_update_collection_as_editor_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "del-editor")
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.put(
        f"/collections/{collection.id}",
        json=_payload("del-editor", version=collection.version),
    )

    # Assert
    assert response.status_code == 403


async def test_update_collection_as_admin_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "renombrable")
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.put(
        f"/collections/{collection.id}",
        json=_payload("renombrada", version=collection.version),
    )

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert body["data"]["name"] == "renombrada"
    assert body["data"]["version"] == 2


async def test_update_with_a_stale_version_returns_409(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — somebody else already moved the collection to version 2
    collection = await _a_collection(db_session, "desactualizada")
    authenticated_as(_user(9, UserRole.ADMIN))
    await async_client.put(
        f"/collections/{collection.id}",
        json=_payload("primera", version=1),
    )

    # Act — this client still holds version 1
    response = await async_client.put(
        f"/collections/{collection.id}",
        json=_payload("segunda", version=1),
    )

    # Assert
    assert response.status_code == 409
    assert response.json()["success"] is False


async def test_update_without_a_version_returns_422(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — `version` is mandatory, so the lock is not opt-in
    collection = await _a_collection(db_session, "sin-version")
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.put(f"/collections/{collection.id}", json=_payload("sin-version"))

    # Assert
    assert response.status_code == 422
    assert "version" in response.json()["error"]


async def test_update_an_unknown_collection_returns_404(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.put("/collections/987654", json=_payload("fantasma", version=1))

    # Assert
    assert response.status_code == 404


async def test_update_an_unknown_collection_as_editor_returns_404_not_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — existence is checked before the role, exactly like `delete`,
    # so an EDITOR gets the same 404 an ADMIN would for the same missing id
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.put("/collections/987654", json=_payload("fantasma", version=1))

    # Assert
    assert response.status_code == 404


# --- deleting: ADMIN only ------------------------------------------------------


async def test_delete_collection_as_viewer_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "borrable-viewer")
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.delete(f"/collections/{collection.id}")

    # Assert
    assert response.status_code == 403


async def test_delete_collection_as_editor_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "borrable-editor")
    authenticated_as(_user(1, UserRole.EDITOR))

    # Act
    response = await async_client.delete(f"/collections/{collection.id}")

    # Assert
    assert response.status_code == 403


async def test_delete_collection_as_admin_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    collection = await _a_collection(db_session, "borrable-admin")
    authenticated_as(_user(9, UserRole.ADMIN))

    # Act
    response = await async_client.delete(f"/collections/{collection.id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["data"] is None
    assert (await async_client.get(f"/collections/{collection.id}")).status_code == 404


async def test_delete_an_unknown_collection_as_viewer_returns_404_not_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — existence is checked before the role, so the status code
    # never leaks whether the row exists, mirroring `test_item_endpoints.py`
    authenticated_as(_user(1, UserRole.VIEWER))

    # Act
    response = await async_client.delete("/collections/987654")

    # Assert
    assert response.status_code == 404
