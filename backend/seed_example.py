"""Populate the sample catalogue (items, collections, tags) — the example half of the seed.

`backend/seed.py` seeds the **template**: the user accounts and their roles, which
survive `scripts/init-template.sh --no-example` because `UserRole`, `has_role()`
and the auth slice all live outside the `example/` folders. This file seeds the
**example** domain that sits on top of those accounts — the neutral catalogue of
items, collections and tags that demonstrates the pattern and is meant to be
deleted. Removing the sample is therefore `rm backend/seed_example.py` plus the
marked import block in `seed.py` (issue #14, `--no-example`): the four fixed
accounts stay, only the data this file wrote goes with it.

`seed.py` calls `seed_example_catalogue()` and passes it the users it just
created or found, because every item needs an `owner_id` and this module has
no repository of its own to fetch one — the whole point of the split is that
users are the template's concern, not this one's.

Like `seed.py`, this module is idempotent (keyed on the fixed collection names
below), reproducible (a fixed Faker seed), and persists exclusively through
`SqlAlchemyItemRepository` and `SqlAlchemyCollectionRepository` — never a bare
`session.add` or raw SQL. Tags have no repository of their own and need none:
`Item.tag_names` is a `list[str]`, and the item repository resolves those names
to `tags` rows as part of `save()`.
"""

import re
from dataclasses import dataclass

import structlog
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.example.collection_repository import (
    SqlAlchemyCollectionRepository,
)
from src.adapters.outbound.persistence.example.item_repository import SqlAlchemyItemRepository
from src.domain.models.example.collection import Collection, CollectionRef
from src.domain.models.example.item import Item
from src.domain.models.user import User, UserRole
from src.domain.ports.example.repositories import CollectionRepository, ItemRepository

logger = structlog.get_logger(__name__)

# Independent from `seed.py`'s `FAKER_SEED`: this module draws from its own
# `Faker()` instance, and fixing its seed is what makes the items it would
# create on a fresh run the same ones a re-run's idempotency check looks for.
FAKER_SEED = 20260713

# How many items to create, and how they are spread across every EDITOR
# account passed in (round-robin, so the second fixed EDITOR always ends up
# owning some of its own — that is what lets a human, or a test, prove one
# editor cannot write another editor's items). Comfortably more than one page
# of the default `page_size=20`, to exercise pagination and search.
ITEM_COUNT = 42
MAX_TAGS_PER_ITEM = 3
MAX_COLLECTIONS_PER_ITEM = 2

# `items.name` is `String(200)`; Faker's `catch_phrase()` never comes close,
# but it is truncated anyway rather than trusted.
MAX_NAME_LENGTH = 200
# `items.slug` is `String(200)` and UNIQUE — checked after slugifying, not
# before, since the slugified form is what actually goes in the column.
MAX_SLUG_LENGTH = 200
_SLUG_INVALID_CHARS = re.compile(r"[^a-z0-9]+")

# `items.category` is `String(50)` and nullable. A fixed, generic vocabulary
# instead of Faker free text, so `category=` filtering has real repeats to
# filter over.
CATEGORY_POOL = (
    "Electronics",
    "Home & Kitchen",
    "Sports & Outdoors",
    "Books",
    "Toys & Games",
    "Beauty",
    "Automotive",
    "Garden",
    "Office",
    "Clothing",
)

# `tags.name` is `String(50)` and UNIQUE — a fixed vocabulary sampled without
# replacement per item, per the repository's composite-primary-key contract
# on `item_tags`.
TAG_VOCABULARY = (
    "featured",
    "new-arrival",
    "top-rated",
    "on-sale",
    "limited-edition",
    "eco-friendly",
    "premium",
    "budget-friendly",
    "trending",
    "clearance",
)


@dataclass(frozen=True, slots=True)
class _CollectionSpec:
    """A collection the seed intends to create, and the marker for idempotency.

    `name` is literal, not Faker-generated, for the same reason the four fixed
    user accounts in `seed.py` are: `collections.name` is unique
    (`uq_collections_name`), and a literal name is what lets a re-run
    recognize "this database is already seeded" instead of drawing a fresh,
    unrecognizable one.
    """

    name: str
    description: str | None


FIXED_COLLECTION_SPECS: tuple[_CollectionSpec, ...] = (
    _CollectionSpec("Featured Picks", "Hand-picked items the catalogue wants to highlight."),
    _CollectionSpec("New Arrivals", "The most recently added items."),
    _CollectionSpec("Clearance Corner", "Items marked down to clear inventory."),
    _CollectionSpec("Staff Favorites", "Items the team keeps recommending."),
    _CollectionSpec("Limited Editions", None),
)


def _slugify(text: str) -> str:
    """Turn `text` into a URL-safe slug, falling back to a fixed value if that empties it out."""
    slug = _SLUG_INVALID_CHARS.sub("-", text.lower()).strip("-")
    return slug[:MAX_SLUG_LENGTH] or "item"


def _unique_slug(name: str, used: set[str]) -> str:
    """Slugify `name` and disambiguate against `used`, checking the length after each attempt."""
    base = _slugify(name)
    slug = base
    suffix = 2
    while slug in used:
        marker = f"-{suffix}"
        slug = f"{base[: MAX_SLUG_LENGTH - len(marker)]}{marker}"
        suffix += 1
    used.add(slug)
    return slug


def _require_id(user: User) -> int:
    """Return `user.id`, or raise if it was never persisted — a seed bug, not a domain one."""
    if user.id is None:
        raise ValueError(f"User {user.email} has no id; it must be saved before owning items")
    return user.id


async def _already_seeded(collection_repository: CollectionRepository) -> bool:
    """The example catalogue is considered seeded once its first fixed collection exists."""
    marker = FIXED_COLLECTION_SPECS[0]
    return await collection_repository.find_by_name(marker.name) is not None


async def _create_collections(collection_repository: CollectionRepository) -> list[Collection]:
    """Persist the fixed collections. `save()` returns each with its DB-assigned id."""
    collections: list[Collection] = []
    for spec in FIXED_COLLECTION_SPECS:
        collection = Collection(name=spec.name, description=spec.description)
        collections.append(await collection_repository.save(collection))
    return collections


def _build_item(
    fake: Faker, owner: User, collection_refs: list[CollectionRef], used_slugs: set[str]
) -> Item:
    """Draw one item: a name, an optional category/description, tags and collections.

    `category` and `description` are left `None` on roughly a fifth of the
    items on purpose, so the optional path on both columns gets exercised by
    the seed data rather than only by hand-written tests.
    """
    name = fake.catch_phrase()[:MAX_NAME_LENGTH]
    slug = _unique_slug(name, used_slugs)
    has_description = fake.boolean(chance_of_getting_true=80)
    description = fake.paragraph(nb_sentences=3) if has_description else None
    has_category = fake.boolean(chance_of_getting_true=80)
    category = fake.random_element(CATEGORY_POOL) if has_category else None

    tag_count = fake.random_int(min=0, max=MAX_TAGS_PER_ITEM)
    tag_names: list[str] = list(fake.random_sample(elements=TAG_VOCABULARY, length=tag_count))

    collection_count = fake.random_int(
        min=0, max=min(MAX_COLLECTIONS_PER_ITEM, len(collection_refs))
    )
    collections: list[CollectionRef] = (
        list(fake.random_sample(elements=collection_refs, length=collection_count))
        if collection_refs
        else []
    )

    return Item(
        name=name,
        slug=slug,
        owner_id=_require_id(owner),
        description=description,
        category=category,
        tag_names=tag_names,
        collections=collections,
    )


async def _create_items(
    item_repository: ItemRepository, fake: Faker, editors: list[User], collections: list[Collection]
) -> list[Item]:
    """Persist `ITEM_COUNT` items, round-robin across `editors` so each one owns some."""
    collection_refs = [
        CollectionRef(id=collection.id, name=collection.name)
        for collection in collections
        if collection.id is not None
    ]
    used_slugs: set[str] = set()
    items: list[Item] = []
    for index in range(ITEM_COUNT):
        owner = editors[index % len(editors)]
        item = _build_item(fake, owner, collection_refs, used_slugs)
        items.append(await item_repository.save(item))
    return items


async def seed_example_catalogue(session: AsyncSession, users: list[User]) -> None:
    """Seed collections, items and tags, or exit cleanly if the catalogue already exists.

    `users` are the accounts `seed.py` already created or found — at least one
    EDITOR must be among them, since every item needs an `owner_id`.
    """
    collection_repository = SqlAlchemyCollectionRepository(session)
    item_repository = SqlAlchemyItemRepository(session)

    if await _already_seeded(collection_repository):
        logger.info(
            "seed_example_skipped",
            reason="database already contains the seed collections",
            hint="recreate the database (alembic downgrade base, then upgrade head) to re-seed",
        )
        return

    editors = [user for user in users if user.role is UserRole.EDITOR]
    if not editors:
        raise ValueError("seed_example_catalogue requires at least one EDITOR user")

    fake = Faker()
    Faker.seed(FAKER_SEED)

    collections = await _create_collections(collection_repository)
    items = await _create_items(item_repository, fake, editors, collections)

    tag_names_used = {tag_name for item in items for tag_name in item.tag_names}
    item_tags = sum(len(item.tag_names) for item in items)
    item_collections = sum(len(item.collections) for item in items)

    logger.info(
        "seed_example_completed",
        items=len(items),
        collections=len(collections),
        tags=len(tag_names_used),
        item_tags=item_tags,
        item_collections=item_collections,
    )
