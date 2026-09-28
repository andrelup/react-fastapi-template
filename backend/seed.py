"""Populate a development database with realistic fastapi-template data.

Run with `make seed` (or `python seed.py` from `backend/`). Every row is written
through the same repositories the application uses, so the seed can never drift
from the persistence rules enforced by the domain.

This file seeds the **template**: user accounts and their roles. `UserRole`,
`has_role()`, the `users.role` column and `AuthService.register()` all live
outside the `example/` folders and survive `scripts/init-template.sh
--no-example`, which is why this half is never deleted. The sample catalogue
that sits on top of these accounts — items, collections and tags — is the
**example** half, seeded by `seed_example.py` and called from the marked block
below; deleting the sample is `rm backend/seed_example.py` plus that block
(issue #14, `--no-example`), and the four fixed accounts created here stay.

Four accounts are created before anything else, with literal (non-Faker)
emails on the neutral, RFC 2606-reserved `example.com` domain: `admin@`,
`editor@`, `editor2@` and `viewer@`, one per `UserRole` value plus a second
EDITOR. They exist so a human can log in by hand, so the frontend's Playwright
specs have stable credentials that do not shift if the Faker-generated pool
below ever changes, and so the permission matrix in `ItemService` /
`CollectionService` can be exercised for real: two EDITOR accounts, each
owning its own items, is what proves one editor cannot write another editor's
catalogue entries.

The script is idempotent: it is keyed on a fixed Faker seed (plus the four
fixed emails above), so the accounts it would create are the same on every
run. If any of them is already in the database, user creation is a no-op
instead of a duplicate-key crash — the example catalogue below is checked
separately, on its own fixed markers, since it can be missing even when the
accounts already exist.
"""

import asyncio
from dataclasses import dataclass

import structlog
from faker import Faker

# Example domain: seeds the sample catalogue (items, collections, tags) that
# hangs off the accounts created below. Delete this import together with
# `seed_example.py` when removing the sample (issue #14, `--no-example`) — the
# fixed accounts are template code and survive that deletion.
from seed_example import seed_example_catalogue
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

# Additional, Faker-generated accounts drawn on top of the four fixed ones,
# so there is more than a handful of users to page and search through.
POOL_EDITOR_COUNT = 3
POOL_VIEWER_COUNT = 6

# `example.com` is reserved for documentation by RFC 2606: it can never
# resolve to a real mailbox, so it doubles as a neutral namespace that keeps a
# seeded account from colliding with one a developer created by hand through
# the API.
EMAIL_DOMAIN = "example.com"

# Dev-only fixture credential, shared by every seeded account so a developer can
# log in straight away. It only ever reaches a local database, and it is logged
# in plaintext at the end of the run on purpose.
SEED_PASSWORD = "ChangeMe123!"  # noqa: S105  # dev seed data, not a real secret

# Column length from `sqlalchemy_models.py` — everything Faker produces is
# truncated to it before it reaches the repository.
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
# by hand. Created before the Faker-generated pool below. Two EDITOR accounts
# on purpose: `editor2@example.com` gets its own items in `seed_example.py`,
# which is what lets a human (or `auth.spec.ts`) prove that one editor cannot
# write another editor's catalogue entries.
FIXED_USER_SPECS: list[_UserSpec] = [
    _UserSpec(email="admin@example.com", name="Demo Admin", role=UserRole.ADMIN),
    _UserSpec(email="editor@example.com", name="Demo Editor", role=UserRole.EDITOR),
    _UserSpec(email="editor2@example.com", name="Demo Second Editor", role=UserRole.EDITOR),
    _UserSpec(email="viewer@example.com", name="Demo Viewer", role=UserRole.VIEWER),
]

# The fixed emails above are reserved so the Faker-generated pool below can
# never (even by a one-in-a-billion coincidence) mint a duplicate of one of
# them and crash the run on `users.email UNIQUE`.
_RESERVED_EMAILS = frozenset(spec.email for spec in FIXED_USER_SPECS)


def _unique_pool_email(fake: Faker) -> str:
    """Draw an email that is unique within this run and distinct from the fixed accounts."""
    email: str = fake.unique.email(domain=EMAIL_DOMAIN)
    while email in _RESERVED_EMAILS:
        email = fake.unique.email(domain=EMAIL_DOMAIN)
    return email


def _build_user_specs(fake: Faker) -> list[_UserSpec]:
    """Draw the pool of additional seed users, editors first, with unique emails."""
    specs: list[_UserSpec] = []
    for role, count in ((UserRole.EDITOR, POOL_EDITOR_COUNT), (UserRole.VIEWER, POOL_VIEWER_COUNT)):
        for _ in range(count):
            name: str = fake.name()
            email = _unique_pool_email(fake)
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


def _log_credentials(users: list[User]) -> None:
    """Log the seed password and every fixed/pool email, grouped by role, in plaintext.

    On purpose, on every run — not just the first — so `make seed` always
    tells a developer what to log in with, whether this run created the
    accounts or found them already there.
    """
    logger.info(
        "seed_credentials",
        password=SEED_PASSWORD,
        admins=[user.email for user in users if user.role is UserRole.ADMIN],
        editors=[user.email for user in users if user.role is UserRole.EDITOR],
        viewers=[user.email for user in users if user.role is UserRole.VIEWER],
    )


async def _seed_users(session: AsyncSession) -> list[User]:
    """Seed the fixed and pool user accounts, or reuse them if already present."""
    fake = Faker()
    Faker.seed(FAKER_SEED)

    user_repository = SqlAlchemyUserRepository(session)
    specs = FIXED_USER_SPECS + _build_user_specs(fake)

    already_seeded = await _find_seeded_users(user_repository, specs)
    if already_seeded:
        logger.info(
            "seed_users_skipped",
            reason="database already contains the seed users",
            existing_users=len(already_seeded),
            hint="recreate the database (alembic downgrade base, then upgrade head) to re-seed",
        )
        return already_seeded

    users = await _create_users(user_repository, BcryptPasswordHasher(), specs)
    logger.info(
        "seed_users_completed",
        users=len(users),
        admins=len([user for user in users if user.role is UserRole.ADMIN]),
        editors=len([user for user in users if user.role is UserRole.EDITOR]),
        viewers=len([user for user in users if user.role is UserRole.VIEWER]),
    )
    return users


async def _seed(session: AsyncSession) -> None:
    """Seed users, then hand them to the example catalogue seed."""
    users = await _seed_users(session)
    _log_credentials(users)
    await seed_example_catalogue(session, users)


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
