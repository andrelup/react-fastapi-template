"""Unit tests for the generic ApiResponse envelope."""

import pytest
from pydantic import ValidationError
from src.adapters.inbound.schemas.common import ApiResponse


def test_api_response_success_serializes_data_and_null_error() -> None:
    # Arrange
    response = ApiResponse[dict[str, str]](success=True, data={"status": "ok"}, error=None)

    # Act
    payload = response.model_dump()

    # Assert
    assert payload == {"success": True, "data": {"status": "ok"}, "error": None}


def test_api_response_failure_carries_error_message_and_null_data() -> None:
    # Arrange
    response = ApiResponse[dict[str, str]](success=False, error="Book not found")

    # Act
    payload = response.model_dump()

    # Assert
    assert payload == {"success": False, "data": None, "error": "Book not found"}


def test_api_response_data_and_error_default_to_none() -> None:
    # Arrange / Act
    response = ApiResponse[str](success=True)

    # Assert
    assert response.data is None
    assert response.error is None


def test_api_response_when_data_mismatches_generic_type_raises_validation_error() -> None:
    # Arrange
    wrong_typed_data = "not-an-int"

    # Act / Assert
    with pytest.raises(ValidationError):
        ApiResponse[int](success=True, data=wrong_typed_data)  # type: ignore[arg-type]
