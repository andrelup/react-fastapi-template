"""Unit tests for BcryptPasswordHasher."""

from src.adapters.outbound.security.password_hasher import BcryptPasswordHasher


def test_hash_returns_a_bcrypt_hash_different_from_the_plain_password() -> None:
    # Arrange
    sut = BcryptPasswordHasher()

    # Act
    hashed_password = sut.hash("s3cret-password")

    # Assert
    assert hashed_password != "s3cret-password"
    assert hashed_password.startswith("$2b$")


def test_verify_with_matching_password_returns_true() -> None:
    # Arrange
    sut = BcryptPasswordHasher()
    hashed_password = sut.hash("s3cret-password")

    # Act
    result = sut.verify("s3cret-password", hashed_password)

    # Assert
    assert result is True


def test_verify_with_wrong_password_returns_false() -> None:
    # Arrange
    sut = BcryptPasswordHasher()
    hashed_password = sut.hash("s3cret-password")

    # Act
    result = sut.verify("wrong-password", hashed_password)

    # Assert
    assert result is False


def test_hash_is_salted_and_therefore_not_deterministic() -> None:
    # Arrange
    sut = BcryptPasswordHasher()

    # Act
    first_hash = sut.hash("same-password")
    second_hash = sut.hash("same-password")

    # Assert
    assert first_hash != second_hash
