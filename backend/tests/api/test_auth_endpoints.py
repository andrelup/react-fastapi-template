"""API tests for the /auth endpoints, using httpx.AsyncClient against the real app.

Each test runs inside a transaction rolled back by the `async_client`
fixture's underlying `db_session`, so no data is left behind.
"""

from httpx import AsyncClient


async def test_register_creates_a_user(async_client: AsyncClient) -> None:
    # Arrange
    payload = {
        "email": "register-success@example.com",
        "name": "New User",
        "password": "s3cret123",
        "role": "customer",
    }

    # Act
    response = await async_client.post("/auth/register", json=payload)

    # Assert
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == "register-success@example.com"
    assert body["data"]["role"] == "customer"
    assert "id" in body["data"]


async def test_register_with_duplicate_email_returns_409(async_client: AsyncClient) -> None:
    # Arrange
    payload = {
        "email": "duplicate@example.com",
        "name": "First User",
        "password": "s3cret123",
        "role": "customer",
    }
    await async_client.post("/auth/register", json=payload)

    # Act
    response = await async_client.post("/auth/register", json=payload)

    # Assert
    assert response.status_code == 409
    body = response.json()
    assert body["success"] is False
    assert body["error"] is not None


async def test_register_with_invalid_payload_returns_422(async_client: AsyncClient) -> None:
    # Arrange
    payload = {"email": "not-an-email", "name": "", "password": "short"}

    # Act
    response = await async_client.post("/auth/register", json=payload)

    # Assert
    assert response.status_code == 422


async def test_register_with_short_password_returns_error_naming_the_field(
    async_client: AsyncClient,
) -> None:
    # Arrange — everything valid except a password under the 8-char minimum.
    payload = {
        "email": "short-password@example.com",
        "name": "Short Password",
        "password": "s3cret",
        "role": "customer",
    }

    # Act
    response = await async_client.post("/auth/register", json=payload)

    # Assert
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"] is not None
    assert "password" in body["error"]


async def test_register_with_multiple_invalid_fields_names_all_of_them(
    async_client: AsyncClient,
) -> None:
    # Arrange — both name and password fail validation.
    payload = {
        "email": "multi-field@example.com",
        "name": "",
        "password": "short",
        "role": "customer",
    }

    # Act
    response = await async_client.post("/auth/register", json=payload)

    # Assert
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    errors = body["error"].split("; ")
    assert len(errors) == 2
    assert any("name" in error for error in errors)
    assert any("password" in error for error in errors)


async def test_register_with_short_password_never_leaks_it_in_the_response(
    async_client: AsyncClient,
) -> None:
    # Arrange — a distinctive plaintext password that must never be echoed back.
    plaintext_password = "t0p-s3cr3t-but-t00-sh0rt"  # noqa: S105 — test fixture, not a real secret.
    payload = {
        "email": "leaky-password@example.com",
        "name": "Leaky Password",
        "password": plaintext_password[:6],
        "role": "customer",
    }

    # Act
    response = await async_client.post("/auth/register", json=payload)

    # Assert — the plaintext password must never appear anywhere in the response body.
    assert response.status_code == 422
    raw_body = response.text
    assert payload["password"] not in raw_body


async def test_login_with_valid_credentials_returns_a_token(async_client: AsyncClient) -> None:
    # Arrange
    await async_client.post(
        "/auth/register",
        json={
            "email": "login-success@example.com",
            "name": "Login User",
            "password": "s3cret123",
            "role": "seller",
        },
    )

    # Act
    response = await async_client.post(
        "/auth/login",
        json={"email": "login-success@example.com", "password": "s3cret123"},
    )

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["token_type"] == "bearer"
    assert body["data"]["access_token"]
    assert body["data"]["user"]["email"] == "login-success@example.com"


async def test_login_with_wrong_password_returns_401(async_client: AsyncClient) -> None:
    # Arrange
    await async_client.post(
        "/auth/register",
        json={
            "email": "login-wrong-pw@example.com",
            "name": "Login User",
            "password": "s3cret123",
            "role": "customer",
        },
    )

    # Act
    response = await async_client.post(
        "/auth/login",
        json={"email": "login-wrong-pw@example.com", "password": "wrong-password"},
    )

    # Assert
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


async def test_login_with_unknown_email_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.post(
        "/auth/login",
        json={"email": "ghost@example.com", "password": "whatever123"},
    )

    # Assert
    assert response.status_code == 401


async def test_login_with_malformed_email_is_indistinguishable_from_wrong_password(
    async_client: AsyncClient,
) -> None:
    # Arrange — a malformed email fails Pydantic validation before reaching the
    # domain service, while a wrong password fails inside the domain service.
    # Both must produce the exact same response so an attacker cannot use the
    # 422-vs-401 status code (or the message) as an oracle.
    malformed_payload = {"email": "not-an-email", "password": "whatever123"}
    wrong_password_payload = {"email": "ghost@example.com", "password": "whatever123"}

    # Act
    malformed_response = await async_client.post("/auth/login", json=malformed_payload)
    wrong_password_response = await async_client.post("/auth/login", json=wrong_password_payload)

    # Assert — byte-identical status code and body.
    assert malformed_response.status_code == 401
    assert wrong_password_response.status_code == 401
    assert malformed_response.text == wrong_password_response.text
    body = malformed_response.json()
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"] == "Invalid email or password"


async def test_get_me_with_valid_token_returns_the_user(async_client: AsyncClient) -> None:
    # Arrange
    await async_client.post(
        "/auth/register",
        json={
            "email": "me-success@example.com",
            "name": "Me User",
            "password": "s3cret123",
            "role": "customer",
        },
    )
    login_response = await async_client.post(
        "/auth/login",
        json={"email": "me-success@example.com", "password": "s3cret123"},
    )
    access_token = login_response.json()["data"]["access_token"]

    # Act
    response = await async_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )

    # Assert
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["email"] == "me-success@example.com"


async def test_get_me_without_token_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.get("/auth/me")

    # Assert
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False


async def test_get_me_with_invalid_token_returns_401(async_client: AsyncClient) -> None:
    # Act
    response = await async_client.get("/auth/me", headers={"Authorization": "Bearer garbage-token"})

    # Assert
    assert response.status_code == 401
