"""Unit tests for the domain exception hierarchy."""

import pytest
from src.domain.exceptions import BookNotFoundError, DomainError, UnauthorizedError


def test_book_not_found_error_is_a_domain_error() -> None:
    # Arrange
    error = BookNotFoundError("book 42 does not exist")

    # Act / Assert
    assert isinstance(error, DomainError)
    assert str(error) == "book 42 does not exist"


def test_unauthorized_error_is_a_domain_error() -> None:
    # Arrange
    error = UnauthorizedError("missing credentials")

    # Act / Assert
    assert isinstance(error, DomainError)
    assert str(error) == "missing credentials"


def test_domain_errors_can_be_caught_as_a_single_family() -> None:
    # Arrange
    def raise_book_missing() -> None:
        raise BookNotFoundError("missing")

    # Act / Assert
    with pytest.raises(DomainError):
        raise_book_missing()
