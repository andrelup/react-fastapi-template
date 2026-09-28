"""Tag use cases: searching the catalogue's label vocabulary and ensuring one exists.

Unlike `Item`, a `Tag` has no owner — it belongs to the catalogue itself, not to a
user, the same shape `CollectionService` already uses. Authorization is therefore
role alone, and there is deliberately no `_ensure_may_write` analogue: there is no
ownership to check. Reading is open to every authenticated role; ensuring a tag
exists requires at least EDITOR, the same minimum `ItemService.create` enforces,
since a tag is otherwise only ever created as a side effect of saving an item.
"""

from src.domain.exceptions import ForbiddenError
from src.domain.models.example.tag import Tag
from src.domain.models.user import User, UserRole, has_role
from src.domain.ports.example.repositories import TagRepository


class TagService:
    """Coordinates the tag use cases and enforces the EDITOR-minimum write rule."""

    def __init__(self, tag_repository: TagRepository) -> None:
        self._tag_repository = tag_repository

    async def search(self, query: str | None, limit: int) -> list[Tag]:
        """Return up to `limit` tags matching `query`. Every authenticated role may read."""
        return await self._tag_repository.search(query, limit)

    async def ensure_exists(self, name: str, current_user: User) -> tuple[Tag, bool]:
        """Return the tag named `name`, creating it if it does not exist yet.

        This is not `create`: it is idempotent by design, so a caller that
        races another one to the same new name still gets back a single
        winning row instead of a conflict. See `SqlAlchemyTagRepository.get_or_create`
        for how the race itself is resolved.

        Raises:
            ForbiddenError: if the user is below EDITOR.
        """
        self._ensure_at_least(current_user, UserRole.EDITOR)
        return await self._tag_repository.get_or_create(name)

    @staticmethod
    def _ensure_at_least(user: User, minimum: UserRole) -> None:
        if not has_role(user, minimum):
            raise ForbiddenError("You do not have permission to perform this action")
