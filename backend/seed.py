"""Populate a development database with realistic fastapi-template data.

Run with `make seed` (or `python seed.py` from `backend/`). Every row is written
through the same repositories the application uses, so the seed can never drift
from the persistence rules enforced by the domain.

Two accounts are created before anything else, with literal (non-Faker) emails:
`seller@bookshelf.dev` and `customer@bookshelf.dev`. They exist so a human can
log in by hand and so the frontend's Playwright login spec has stable
credentials that do not shift if the Faker-generated pool below ever changes.

The script is idempotent: it is keyed on a fixed Faker seed (plus the two fixed
emails above), so the accounts it would create are the same on every run. If
any of them is already in the database, the run is a no-op instead of a
duplicate-key crash.
"""

import asyncio
from dataclasses import dataclass

import structlog
from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession
from src.adapters.outbound.persistence.database import async_session_factory, engine
from src.adapters.outbound.persistence.user_repository import SqlAlchemyUserRepository
from src.adapters.outbound.security.password_hasher import BcryptPasswordHasher
from src.config.logging import configure_logging
from src.domain.models.user import User, UserRole

configure_logging()
logger = structlog.get_logger(__name__)

# Fixing the Faker seed makes the whole fixture reproducible: the same emails
# on every machine and on every run. That is what lets the idempotency check
# below recognize an already-seeded database.
FAKER_SEED = 20260712

SELLER_COUNT = 4
CUSTOMER_COUNT = 6

# Namespaced so a seeded account can never collide with one a developer created
# by hand through the API.
EMAIL_DOMAIN = "bookshelf.dev"

# Dev-only fixture credential, shared by every seeded account so a developer can
# log in straight away. It only ever reaches a local database, and it is logged
# in plaintext at the end of the run on purpose.
SEED_PASSWORD = "BookShelf123!"  # noqa: S105  # dev seed data, not a real secret

# Column lengths from `sqlalchemy_models.py` — everything Faker produces is
# truncated to them before it reaches the repository.
MAX_NAME_LENGTH = 255


@dataclass(frozen=True, slots=True)
class _UserSpec:
    """A user the seed intends to create, before its password is hashed.

    Hashing is deliberately deferred: bcrypt is slow, and a re-run that finds
    the database already seeded must not pay for ten hashes it will throw away.
    """

    email: str
    name: str
    role: UserRole


# Fixed, literal accounts — not drawn from Faker — so they never change across
# a Faker version bump and so they double as the credentials a human types in
# by hand. Created before the Faker-generated pool below.
FIXED_USER_SPECS: list[_UserSpec] = [
    _UserSpec(email="seller@bookshelf.dev", name="Demo Seller", role=UserRole.SELLER),
    _UserSpec(email="customer@bookshelf.dev", name="Demo Customer", role=UserRole.CUSTOMER),
]


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


async def _seed(session: AsyncSession) -> None:
    """Seed the database, or exit cleanly if it is already seeded."""
    fake = Faker()
    Faker.seed(FAKER_SEED)

    user_repository = SqlAlchemyUserRepository(session)
    # Fixed accounts first, then the Faker-generated pool.
    specs = FIXED_USER_SPECS + _build_user_specs(fake)

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

    logger.info(
        "seed_completed",
        users=len(users),
        sellers=len([user for user in users if user.role is UserRole.SELLER]),
        customers=len([user for user in users if user.role is UserRole.CUSTOMER]),
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
