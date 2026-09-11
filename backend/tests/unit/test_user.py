"""Unit tests for the `User` domain model — the `has_role` hierarchy helper."""

import pytest
from src.domain.models.user import User, UserRole, has_role


def make_user(role: UserRole) -> User:
    """Build a `User` with the given role; the other fields are incidental."""
    return User(
        id=1,
        email="user@example.com",
        name="User",
        role=role,
        hashed_password="hashed:pw",
    )


@pytest.mark.parametrize(
    ("role", "minimum", "expected"),
    [
        (UserRole.ADMIN, UserRole.ADMIN, True),
        (UserRole.ADMIN, UserRole.EDITOR, True),
        (UserRole.ADMIN, UserRole.VIEWER, True),
        (UserRole.EDITOR, UserRole.ADMIN, False),
        (UserRole.EDITOR, UserRole.EDITOR, True),
        (UserRole.EDITOR, UserRole.VIEWER, True),
        (UserRole.VIEWER, UserRole.ADMIN, False),
        (UserRole.VIEWER, UserRole.EDITOR, False),
        (UserRole.VIEWER, UserRole.VIEWER, True),
    ],
    ids=[
        "test_has_role_when_admin_checked_against_admin_returns_true",
        "test_has_role_when_admin_checked_against_editor_returns_true",
        "test_has_role_when_admin_checked_against_viewer_returns_true",
        "test_has_role_when_editor_checked_against_admin_returns_false",
        "test_has_role_when_editor_checked_against_editor_returns_true",
        "test_has_role_when_editor_checked_against_viewer_returns_true",
        "test_has_role_when_viewer_checked_against_admin_returns_false",
        "test_has_role_when_viewer_checked_against_editor_returns_false",
        "test_has_role_when_viewer_checked_against_viewer_returns_true",
    ],
)
def test_has_role(role: UserRole, minimum: UserRole, expected: bool) -> None:
    # Arrange
    user = make_user(role)

    # Act
    result = has_role(user, minimum)

    # Assert
    assert result is expected
