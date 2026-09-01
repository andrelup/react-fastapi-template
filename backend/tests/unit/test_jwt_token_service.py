"""Unit tests for JwtTokenService."""

from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt
from src.adapters.outbound.security.jwt_token_service import JwtTokenService
from src.domain.exceptions import UnauthorizedError


def make_service(expires_minutes: int = 60) -> JwtTokenService:
    return JwtTokenService(
        secret_key="test-secret", algorithm="HS256", expires_minutes=expires_minutes
    )


def test_create_access_token_returns_a_token_decodable_with_the_same_secret() -> None:
    # Arrange
    sut = make_service()

    # Act
    token = sut.create_access_token("user@example.com")
    payload = jwt.decode(token, "test-secret", algorithms=["HS256"])

    # Assert
    assert payload["sub"] == "user@example.com"


def test_decode_token_returns_the_original_subject() -> None:
    # Arrange
    sut = make_service()
    token = sut.create_access_token("user@example.com")

    # Act
    subject = sut.decode_token(token)

    # Assert
    assert subject == "user@example.com"


def test_decode_token_with_garbage_token_raises_unauthorized_error() -> None:
    # Arrange
    sut = make_service()

    # Act / Assert
    with pytest.raises(UnauthorizedError):
        sut.decode_token("not-a-real-token")


def test_decode_token_with_wrong_secret_raises_unauthorized_error() -> None:
    # Arrange
    issuer = make_service()
    verifier = JwtTokenService(secret_key="other-secret", algorithm="HS256", expires_minutes=60)
    token = issuer.create_access_token("user@example.com")

    # Act / Assert
    with pytest.raises(UnauthorizedError):
        verifier.decode_token(token)


def test_decode_token_with_expired_token_raises_unauthorized_error() -> None:
    # Arrange
    sut = make_service()
    expired_payload = {"sub": "user@example.com", "exp": datetime.now(UTC) - timedelta(minutes=1)}
    expired_token = jwt.encode(expired_payload, "test-secret", algorithm="HS256")

    # Act / Assert
    with pytest.raises(UnauthorizedError):
        sut.decode_token(expired_token)


def test_decode_token_without_subject_raises_unauthorized_error() -> None:
    # Arrange
    sut = make_service()
    payload_without_subject = {"exp": datetime.now(UTC) + timedelta(minutes=5)}
    token = jwt.encode(payload_without_subject, "test-secret", algorithm="HS256")

    # Act / Assert
    with pytest.raises(UnauthorizedError):
        sut.decode_token(token)
