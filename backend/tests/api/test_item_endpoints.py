"""API tests for the /items endpoints: the authorization matrix over HTTP.

`authenticated_as` overrides `get_current_user`, so the status codes are
asserted without minting real JWTs. The users are still inserted for real:
`items.owner_id` is a foreign key against `users`, so any request that
actually writes an item needs its author to exist in the database — an
invented `User(id=1, ...)` would come back as a 409 from the IntegrityError
handler instead of the 201 the test is about.
"""

from collections.abc import Callable

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.example.item_repository import SqlAlchemyItemRepository
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole


async def _a_user(db_session: AsyncSession, role: UserRole, email: str) -> User:
    """Insert a user with the given role and return it, id included."""
    return await SqlAlchemyUserRepository(db_session).save(
        User(email=email, name=role.value.title(), role=role, hashed_password="hashed:pw")
    )


async def _an_item(db_session: AsyncSession, owner_id: int, slug: str = "manual") -> Item:
    """Insert an item owned by `owner_id`, bypassing the API."""
    return await SqlAlchemyItemRepository(db_session).save(
        Item(name="Manual", slug=slug, owner_id=owner_id, category="documentacion")
    )


def _payload(slug: str = "nuevo-item", **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Nuevo item",
        "slug": slug,
        "description": "Creado desde el test",
        "category": "documentacion",
        "tags": ["onboarding"],
    }
    payload.update(overrides)
    return payload


# --- authentication -------------------------------------------------------


async def test_list_items_without_credentials_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.get("/items")

    # Assert
    assert response.status_code == 401
    assert response.json()["success"] is False


async def test_create_item_without_credentials_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.post("/items", json=_payload())

    # Assert
    assert response.status_code == 401


# --- reading: every authenticated role --------------------------------------


async def test_list_items_as_viewer_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "list-viewer@example.com")
    assert viewer.id is not None
    await _an_item(db_session, viewer.id, "listado")
    authenticated_as(viewer)

    # Act
    response = await async_client.get("/items")

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True
    assert body["data"]["page"] == 1
    assert body["data"]["page_size"] == 20
    assert any(item["slug"] == "listado" for item in body["data"]["items"])


async def test_list_items_narrows_by_category(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "cat-viewer@example.com")
    assert viewer.id is not None
    await _an_item(db_session, viewer.id, "con-categoria")
    authenticated_as(viewer)

    # Act
    response = await async_client.get("/items", params={"category": "no-existe"})

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["total"] == 0


async def test_search_items_is_not_swallowed_by_the_id_route(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — `/items/{item_id}` would happily match the literal "search"
    # and fail `int` coercion with a 422 if it were declared first
    viewer = await _a_user(db_session, UserRole.VIEWER, "search-viewer@example.com")
    assert viewer.id is not None
    await _an_item(db_session, viewer.id, "buscable")
    authenticated_as(viewer)

    # Act
    response = await async_client.get("/items/search", params={"q": "Manual"})

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["total"] >= 1


async def test_get_item_returns_the_item(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "get-viewer@example.com")
    assert viewer.id is not None
    item = await _an_item(db_session, viewer.id, "uno-solo")
    authenticated_as(viewer)

    # Act
    response = await async_client.get(f"/items/{item.id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["slug"] == "uno-solo"


async def test_get_an_unknown_item_returns_404(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "404-viewer@example.com")
    authenticated_as(viewer)

    # Act
    response = await async_client.get("/items/987654")

    # Assert
    assert response.status_code == 404
    assert response.json()["success"] is False


# --- creating ---------------------------------------------------------------


async def test_create_item_as_viewer_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "create-viewer@example.com")
    authenticated_as(viewer)

    # Act
    response = await async_client.post("/items", json=_payload())

    # Assert
    assert response.status_code == 403
    assert response.json()["success"] is False


async def test_create_item_as_editor_returns_201_and_assigns_ownership(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    editor = await _a_user(db_session, UserRole.EDITOR, "create-editor@example.com")
    authenticated_as(editor)

    # Act
    response = await async_client.post("/items", json=_payload("creado-por-editor"))

    # Assert
    body = response.json()
    assert response.status_code == 201
    assert body["data"]["owner_id"] == editor.id
    assert body["data"]["version"] == 1
    assert body["data"]["tags"] == ["onboarding"]


async def test_create_item_ignores_an_owner_id_sent_by_the_client(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — the schema has no `owner_id`, so publishing as somebody else
    # is not expressible
    editor = await _a_user(db_session, UserRole.EDITOR, "spoof-editor@example.com")
    authenticated_as(editor)

    # Act
    response = await async_client.post("/items", json=_payload("sin-suplantacion", owner_id=999))

    # Assert
    assert response.status_code == 201
    assert response.json()["data"]["owner_id"] == editor.id


async def test_create_item_with_a_duplicate_slug_returns_409(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    editor = await _a_user(db_session, UserRole.EDITOR, "dup-editor@example.com")
    assert editor.id is not None
    await _an_item(db_session, editor.id, "ya-existe")
    authenticated_as(editor)

    # Act
    response = await async_client.post("/items", json=_payload("ya-existe"))

    # Assert
    assert response.status_code == 409


async def test_create_item_with_an_invalid_slug_returns_422(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    editor = await _a_user(db_session, UserRole.EDITOR, "slug-editor@example.com")
    authenticated_as(editor)

    # Act
    response = await async_client.post("/items", json=_payload("Con Mayusculas Y Espacios"))

    # Assert
    assert response.status_code == 422
    assert "slug" in response.json()["error"]


# --- updating ---------------------------------------------------------------


async def test_update_item_as_viewer_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "update-viewer@example.com")
    assert viewer.id is not None
    item = await _an_item(db_session, viewer.id, "del-viewer")
    authenticated_as(viewer)

    # Act — owning it does not help
    response = await async_client.put(
        f"/items/{item.id}", json=_payload("del-viewer", version=item.version)
    )

    # Assert
    assert response.status_code == 403


async def test_update_its_own_item_as_editor_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    editor = await _a_user(db_session, UserRole.EDITOR, "own-editor@example.com")
    assert editor.id is not None
    item = await _an_item(db_session, editor.id, "propio")
    authenticated_as(editor)

    # Act
    response = await async_client.put(
        f"/items/{item.id}", json=_payload("propio", name="Renombrado", version=item.version)
    )

    # Assert
    body = response.json()
    assert response.status_code == 200
    assert body["data"]["name"] == "Renombrado"
    assert body["data"]["version"] == 2


async def test_update_someone_elses_item_as_editor_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    owner = await _a_user(db_session, UserRole.EDITOR, "owner-editor@example.com")
    intruder = await _a_user(db_session, UserRole.EDITOR, "intruder-editor@example.com")
    assert owner.id is not None
    item = await _an_item(db_session, owner.id, "ajeno")
    authenticated_as(intruder)

    # Act
    response = await async_client.put(
        f"/items/{item.id}", json=_payload("ajeno", version=item.version)
    )

    # Assert
    assert response.status_code == 403


async def test_update_someone_elses_item_as_admin_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    owner = await _a_user(db_session, UserRole.EDITOR, "admin-target@example.com")
    admin = await _a_user(db_session, UserRole.ADMIN, "admin-editor@example.com")
    assert owner.id is not None
    item = await _an_item(db_session, owner.id, "intervenible")
    authenticated_as(admin)

    # Act
    response = await async_client.put(
        f"/items/{item.id}", json=_payload("intervenible", name="Intervenido", version=item.version)
    )

    # Assert
    assert response.status_code == 200
    assert response.json()["data"]["name"] == "Intervenido"


async def test_update_with_a_stale_version_returns_409(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — somebody else already moved the item to version 2
    editor = await _a_user(db_session, UserRole.EDITOR, "stale-editor@example.com")
    assert editor.id is not None
    item = await _an_item(db_session, editor.id, "desactualizado")
    authenticated_as(editor)
    await async_client.put(
        f"/items/{item.id}", json=_payload("desactualizado", name="Primera", version=1)
    )

    # Act — this client still holds version 1
    response = await async_client.put(
        f"/items/{item.id}", json=_payload("desactualizado", name="Segunda", version=1)
    )

    # Assert
    assert response.status_code == 409
    assert response.json()["success"] is False


async def test_update_without_a_version_returns_422(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — `version` is mandatory, so the lock is not opt-in
    editor = await _a_user(db_session, UserRole.EDITOR, "noversion-editor@example.com")
    assert editor.id is not None
    item = await _an_item(db_session, editor.id, "sin-version")
    authenticated_as(editor)

    # Act
    response = await async_client.put(f"/items/{item.id}", json=_payload("sin-version"))

    # Assert
    assert response.status_code == 422
    assert "version" in response.json()["error"]


async def test_update_an_unknown_item_returns_404(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    admin = await _a_user(db_session, UserRole.ADMIN, "update404-admin@example.com")
    authenticated_as(admin)

    # Act
    response = await async_client.put("/items/987654", json=_payload("fantasma", version=1))

    # Assert
    assert response.status_code == 404


# --- deleting ---------------------------------------------------------------


async def test_delete_item_as_viewer_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    viewer = await _a_user(db_session, UserRole.VIEWER, "delete-viewer@example.com")
    assert viewer.id is not None
    item = await _an_item(db_session, viewer.id, "borrable-viewer")
    authenticated_as(viewer)

    # Act
    response = await async_client.delete(f"/items/{item.id}")

    # Assert
    assert response.status_code == 403


async def test_delete_its_own_item_as_editor_returns_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — deleting is an ADMIN privilege across the whole system
    editor = await _a_user(db_session, UserRole.EDITOR, "delete-editor@example.com")
    assert editor.id is not None
    item = await _an_item(db_session, editor.id, "borrable-editor")
    authenticated_as(editor)

    # Act
    response = await async_client.delete(f"/items/{item.id}")

    # Assert
    assert response.status_code == 403


async def test_delete_someone_elses_item_as_admin_returns_200(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange
    owner = await _a_user(db_session, UserRole.EDITOR, "delete-target@example.com")
    admin = await _a_user(db_session, UserRole.ADMIN, "delete-admin@example.com")
    assert owner.id is not None
    item = await _an_item(db_session, owner.id, "borrable-admin")
    authenticated_as(admin)

    # Act
    response = await async_client.delete(f"/items/{item.id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["data"] is None
    assert (await async_client.get(f"/items/{item.id}")).status_code == 404


async def test_delete_an_unknown_item_as_viewer_returns_404_not_403(
    async_client: AsyncClient, db_session: AsyncSession, authenticated_as: Callable[[User], None]
) -> None:
    # Arrange — existence is checked before the role, so the status code never
    # leaks whether the row exists
    viewer = await _a_user(db_session, UserRole.VIEWER, "delete404-viewer@example.com")
    authenticated_as(viewer)

    # Act
    response = await async_client.delete("/items/987654")

    # Assert
    assert response.status_code == 404
