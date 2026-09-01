"""Populate a development database with realistic BookShelf data.

Run with `make seed` (or `python seed.py` from `backend/`). Every row is written
through the same repositories the application uses, so the seed can never drift
from the persistence rules enforced by the domain.

Insertion order is dictated by the foreign keys: users first (a book needs a
seller, a favourite list needs a customer), then books, then the favourite lists
that reference them.

The script is idempotent: it is keyed on a fixed Faker seed, so the accounts it
would create are the same on every run. If any of them is already in the
database, the run is a no-op instead of a duplicate-key crash.
"""

import asyncio
from dataclasses import dataclass

import structlog
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.book_repository import SqlAlchemyBookRepository
from src.adapters.outbound.persistence.database import async_session_factory, engine
from src.adapters.outbound.persistence.favourite_list_repository import (
    SqlAlchemyFavouriteListRepository,
)
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.adapters.outbound.security.password_hasher import BcryptPasswordHasher
from src.domain.models.book import Book
from src.domain.models.favourite import FavouriteList
from src.domain.models.user import User, UserRole

logger = structlog.get_logger(__name__)

# Fixing the Faker seed makes the whole fixture reproducible: the same emails,
# titles and ISBNs on every machine and on every run. That is what lets the
# idempotency check below recognize an already-seeded database.
FAKER_SEED = 20260712

SELLER_COUNT = 4
CUSTOMER_COUNT = 6
BOOK_COUNT = 200
MAX_LISTS_PER_CUSTOMER = 3
MIN_BOOKS_PER_LIST = 3
MAX_BOOKS_PER_LIST = 12

# Namespaced so a seeded account can never collide with one a developer created
# by hand through the API.
EMAIL_DOMAIN = "bookshelf.dev"

# Dev-only fixture credential, shared by every seeded account so a developer can
# log in straight away. It only ever reaches a local database, and it is logged
# in plaintext at the end of the run on purpose.
SEED_PASSWORD = "BookShelf123!"  # noqa: S105  # dev seed data, not a real secret

# Column lengths from `sqlalchemy_models.py` — everything Faker produces is
# truncated to them before it reaches the repository.
MAX_TITLE_LENGTH = 255
MAX_AUTHOR_LENGTH = 255
MAX_NAME_LENGTH = 255
MAX_CATEGORY_LENGTH = 100

CATEGORIES = [
    "Fiction",
    "Non-fiction",
    "Science Fiction",
    "Fantasy",
    "Mystery",
    "Thriller",
    "Romance",
    "Historical",
    "Biography",
    "Poetry",
    "Science",
    "Technology",
    "Philosophy",
    "Travel",
    "Children",
]

# `favourite_lists` is unique on (owner_id, name), so each customer's list names
# are sampled from this pool without replacement.
LIST_NAMES = [
    "Summer reads",
    "Winter reads",
    "To read next",
    "All-time favourites",
    "Weekend picks",
    "Book club",
    "Gift ideas",
    "Commute reads",
]


@dataclass(frozen=True, slots=True)
class _UserSpec:
    """A user the seed intends to create, before its password is hashed.

    Hashing is deliberately deferred: bcrypt is slow, and a re-run that finds
    the database already seeded must not pay for ten hashes it will throw away.
    """

    email: str
    name: str
    role: UserRole


def _build_user_specs(fake: Faker) -> list[_UserSpec]:
    """Draw the 10 seed users, sellers first, with unique emails."""
    specs: list[_UserSpec] = []
    for role, count in ((UserRole.SELLER, SELLER_COUNT), (UserRole.CUSTOMER, CUSTOMER_COUNT)):
        for _ in range(count):
            name: str = fake.name()
            # `unique` guarantees no repeat within this run; bare `email()`
            # collides surprisingly often over so few draws.
            email: str = fake.unique.email(domain=EMAIL_DOMAIN)
            specs.append(_UserSpec(email=email, name=name[:MAX_NAME_LENGTH], role=role))
    return specs


async def _find_seeded_users(
    user_repository: SqlAlchemyUserRepository, specs: list[_UserSpec]
) -> list[User]:
    """Return the seed users that already exist in the database."""
    existing: list[User] = []
    for spec in specs:
        user = await user_repository.find_by_email(spec.email)
        if user is not None:
            existing.append(user)
    return existing


async def _create_users(
    user_repository: SqlAlchemyUserRepository,
    password_hasher: BcryptPasswordHasher,
    specs: list[_UserSpec],
) -> list[User]:
    """Persist the users. `save()` returns the instance carrying the DB-assigned id."""
    users: list[User] = []
    for spec in specs:
        user = User(
            email=spec.email,
            name=spec.name,
            role=spec.role,
            hashed_password=password_hasher.hash(SEED_PASSWORD),
        )
        users.append(await user_repository.save(user))
    return users


def _build_book(fake: Faker, seller_ids: list[int]) -> Book:
    """Draw one book: `price > 0` and `stock >= 0`, as `BookService._validate` demands."""
    title: str = fake.sentence(nb_words=4).rstrip(".")
    author: str = fake.name()
    # `isbn13()` yields 17 characters with separators — well inside String(20).
    isbn: str = fake.unique.isbn13()
    price = fake.pydecimal(left_digits=2, right_digits=2, min_value=5, max_value=99)
    category: str = fake.random_element(elements=CATEGORIES)
    description: str = fake.paragraph(nb_sentences=3)
    return Book(
        title=title[:MAX_TITLE_LENGTH],
        author=author[:MAX_AUTHOR_LENGTH],
        isbn=isbn,
        price=float(price),
        stock=fake.random_int(min=0, max=250),
        seller_id=fake.random_element(elements=seller_ids),
        description=description,
        category=category[:MAX_CATEGORY_LENGTH],
    )


async def _create_books(
    fake: Faker, book_repository: SqlAlchemyBookRepository, seller_ids: list[int]
) -> list[int]:
    """Persist the catalog and return the ids the favourite lists will point at."""
    book_ids: list[int] = []
    for _ in range(BOOK_COUNT):
        saved = await book_repository.save(_build_book(fake, seller_ids))
        if saved.id is not None:
            book_ids.append(saved.id)
    return book_ids


async def _create_favourite_lists(
    fake: Faker,
    favourite_list_repository: SqlAlchemyFavouriteListRepository,
    customer_ids: list[int],
    book_ids: list[int],
) -> tuple[int, int]:
    """Give every customer 1..N lists of books. Returns (lists created, items created)."""
    list_count = 0
    item_count = 0
    for customer_id in customer_ids:
        # Sampled without replacement: (owner_id, name) is unique.
        names: list[str] = list(
            fake.random_sample(
                elements=LIST_NAMES, length=fake.random_int(min=1, max=MAX_LISTS_PER_CUSTOMER)
            )
        )
        for name in names:
            # Also without replacement: (list_id, book_id) is unique.
            sampled_book_ids: list[int] = list(
                fake.random_sample(
                    elements=book_ids,
                    length=fake.random_int(min=MIN_BOOKS_PER_LIST, max=MAX_BOOKS_PER_LIST),
                )
            )
            await favourite_list_repository.save(
                FavouriteList(owner_id=customer_id, name=name, book_ids=sampled_book_ids)
            )
            list_count += 1
            item_count += len(sampled_book_ids)
    return list_count, item_count


async def _seed(session: AsyncSession) -> None:
    """Seed the database, or exit cleanly if it is already seeded."""
    fake = Faker()
    Faker.seed(FAKER_SEED)

    user_repository = SqlAlchemyUserRepository(session)
    specs = _build_user_specs(fake)

    already_seeded = await _find_seeded_users(user_repository, specs)
    if already_seeded:
        logger.info(
            "seed_skipped",
            reason="database already contains the seed users",
            existing_users=len(already_seeded),
            hint="recreate the database (alembic downgrade base, then upgrade head) to re-seed",
        )
        return

    users = await _create_users(user_repository, BcryptPasswordHasher(), specs)
    seller_ids = [user.id for user in users if user.role is UserRole.SELLER and user.id is not None]
    customer_ids = [
        user.id for user in users if user.role is UserRole.CUSTOMER and user.id is not None
    ]

    book_ids = await _create_books(fake, SqlAlchemyBookRepository(session), seller_ids)
    list_count, item_count = await _create_favourite_lists(
        fake, SqlAlchemyFavouriteListRepository(session), customer_ids, book_ids
    )

    logger.info(
        "seed_completed",
        users=len(users),
        sellers=len(seller_ids),
        customers=len(customer_ids),
        books=len(book_ids),
        favourite_lists=list_count,
        favourite_list_items=item_count,
    )
    logger.info(
        "seed_credentials",
        password=SEED_PASSWORD,
        sellers=[user.email for user in users if user.role is UserRole.SELLER],
        customers=[user.email for user in users if user.role is UserRole.CUSTOMER],
    )


async def _run() -> None:
    """Open a session, seed, and dispose of the engine so asyncpg shuts down cleanly."""
    try:
        async with async_session_factory() as session:
            await _seed(session)
    finally:
        await engine.dispose()


def main() -> None:
    """Entry point for `make seed`."""
    asyncio.run(_run())


if __name__ == "__main__":
    main()
