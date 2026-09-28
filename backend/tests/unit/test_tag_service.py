"""Unit tests for `TagService`: role-only authorization, no ownership.

The port is satisfied by an in-memory fake declared here rather than promoted
to `tests/fakes/`: only this module needs it, and `tests/fakes/__init__.py`
says a fake moves there only once a second module needs it too.
"""

import pytest
from src.domain.exceptions import ForbiddenError
from src.domain.models.example.tag import Tag
from src.domain.models.user import User, UserRole
from src.domain.services.example.tag_service import TagService


class FakeTagRepository:
    """In-memory `TagRepository`.

    `get_or_create` only mirrors the race-free path: two concurrent callers
    cannot race over this single in-memory dict the way two DB sessions can,
    so the unique-constraint race is proven at the integration tier instead —
    see `tests/integration/test_tag_repository.py` for why that split is
    deliberate rather than a gap.
    """

    def __init__(self, tags: list[Tag] | None = None) -> None:
        self._tags = {tag.name: tag for tag in tags or []}
        self._next_id = max((tag.id for tag in self._tags.values() if tag.id), default=0) + 1

    async def search(self, query: str | None, limit: int) -> list[Tag]:
        matches = [
            tag for tag in self._tags.values() if query is None or query.lower() in tag.name.lower()
        ]
        return sorted(matches, key=lambda tag: tag.name)[:limit]

    async def get_or_create(self, name: str) -> tuple[Tag, bool]:
        existing = self._tags.get(name)
        if existing is not None:
            return existing, False
        created = Tag(id=self._next_id, name=name)
        self._next_id += 1
        self._tags[name] = created
        return created, True


def _user(user_id: int, role: UserRole) -> User:
    return User(
        id=user_id,
        email=f"user{user_id}@example.com",
        name=f"User {user_id}",
        role=role,
        hashed_password="hashed:pw",
    )


# --- search -------------------------------------------------------------------


async def test_search_with_no_query_returns_all_tags_ordered_by_name() -> None:
    # Arrange
    sut = TagService(FakeTagRepository([Tag(id=1, name="zeta"), Tag(id=2, name="alfa")]))

    # Act
    tags = await sut.search(None, limit=50)

    # Assert
    assert [tag.name for tag in tags] == ["alfa", "zeta"]


async def test_search_with_a_query_returns_only_the_matches() -> None:
    # Arrange
    sut = TagService(FakeTagRepository([Tag(id=1, name="onboarding"), Tag(id=2, name="interno")]))

    # Act
    tags = await sut.search("board", limit=50)

    # Assert
    assert [tag.name for tag in tags] == ["onboarding"]


async def test_search_respects_the_limit() -> None:
    # Arrange
    sut = TagService(FakeTagRepository([Tag(id=i, name=f"tag-{i}") for i in range(1, 6)]))

    # Act
    tags = await sut.search(None, limit=2)

    # Assert
    assert len(tags) == 2


# --- ensure_exists --------------------------------------------------------------


async def test_ensure_exists_as_viewer_raises_forbidden_error() -> None:
    # Arrange
    viewer = _user(1, UserRole.VIEWER)
    sut = TagService(FakeTagRepository())

    # Act & Assert
    with pytest.raises(ForbiddenError):
        await sut.ensure_exists("onboarding", viewer)


async def test_ensure_exists_as_editor_with_a_new_name_creates_it() -> None:
    # Arrange
    editor = _user(1, UserRole.EDITOR)
    sut = TagService(FakeTagRepository())

    # Act
    tag, created = await sut.ensure_exists("onboarding", editor)

    # Assert
    assert created is True
    assert tag.id is not None
    assert tag.name == "onboarding"


async def test_ensure_exists_as_admin_with_an_existing_name_does_not_duplicate_it() -> None:
    # Arrange
    admin = _user(9, UserRole.ADMIN)
    sut = TagService(FakeTagRepository([Tag(id=1, name="onboarding")]))

    # Act
    tag, created = await sut.ensure_exists("onboarding", admin)

    # Assert
    assert created is False
    assert tag.id == 1
