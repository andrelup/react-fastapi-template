# The Example Domain, and How to Delete It

The repository ships a worked sample — a small catalogue of items, the collections that group them
and the tags that label them — so that the template arrives with real code, real tests and a green
CI rather than an empty skeleton. It is there to be read, copied and then **deleted**.

This document is the one place allowed to depend on that sample existing. Every other document in
`docs/` describes patterns that outlive it; if you find one narrating the catalogue, that is a bug
in the document.

## The convention

Everything belonging to the sample rather than to the template lives in an `example/` folder
**inside its own layer**, never in one folder cutting across layers. The layer structure is the
architecture; `example/` is only a removability marker inside it.

```
backend/src/domain/models/example/
backend/src/domain/ports/example/
backend/src/domain/services/example/
backend/src/adapters/outbound/persistence/example/
backend/src/adapters/inbound/api/example/
backend/src/adapters/inbound/schemas/example/
frontend/src/features/example/
```

The dependency runs **example → template, never the reverse**. That is the rule the whole
arrangement rests on, and it is why the sample's `items` table points at `users` with a bare foreign
key and no `relationship()`: the moment the template's `UserORM` referenced the sample, the folder
would stop being deletable on its own.

Every time you are tempted to reference example code from template code, you are adding a step to
the procedure below.

## Where the convention does not reach

Two categories sit outside the `example/` folders and have to be handled by name. Both are
deliberate, not oversights, but they are the part a mechanical `rm -rf` misses.

**The tests.** `backend/tests/` is organised by tier, not by ownership, so the sample's tests are
named after its entities instead of living under an `example/` folder:

```
backend/tests/unit/test_item_service.py
backend/tests/unit/test_collection_service.py
backend/tests/unit/test_example_orm_metadata.py
backend/tests/unit/test_tag_service.py
backend/tests/api/test_item_endpoints.py
backend/tests/api/test_collection_endpoints.py
backend/tests/api/test_tag_endpoints.py
backend/tests/integration/test_item_repository.py
backend/tests/integration/test_collection_repository.py
backend/tests/integration/test_tag_repository.py
backend/tests/integration/test_optimistic_locking.py
backend/tests/fakes/fake_collection_repository.py
```

**The template files that reference the sample.** A handful of template modules name the example on
purpose — router registrations, a couple of providers, the navigation entries in `navigation.ts`.
They are edited, not deleted, and they are enumerated in the procedure. `frontend/src/lib/paths.ts`,
with the `catalog` / `mine` rules of `useNavEntryActive.ts`, is sample code that lives outside any
`example/` folder.

## Deleting it

This is what `scripts/init-template.sh --no-example` automates (issue #14, not written yet). Done by
hand, in this order:

**Backend — delete**

1. `rm -rf` each of the six backend `example/` directories listed above.
2. Delete the twelve test files listed above. `backend/tests/fakes/` is then empty except for its
   `__init__.py`; leave the package, it is where the next fake with two consumers goes.
3. `rm backend/seed.py backend/seed_example.py`. Both halves of the seed go, the fixed accounts
   included: they are sample data too. Steps 18-21 unwire them.

**Backend — edit**

4. `backend/alembic/env.py` — delete the marked import:
   `from src.adapters.outbound.persistence import example  # noqa: F401`, which carries the comment
   saying so.
5. `backend/alembic/versions/d5d3e24a6992_create_initial_schema.py` — remove the `items`,
   `collections`, `tags`, `item_tags` and `item_collections` tables from `upgrade()` and their drops
   from `downgrade()`. The revision is shared with the template's `users` table, so it is edited,
   never deleted. Delete `a3f1c9b2d7e4_drop_items_slug.py` beside it: it only alters the sample's
   `items` table, so without that table it has nothing left to run against, and the initial revision
   becomes the head again.
6. `backend/src/main.py` — drop `include_router(item_router)`, `include_router(collection_router)`
   and `include_router(tag_router)`, and their imports.
7. `backend/src/config/container.py` — drop the six providers: `get_item_repository`,
   `get_collection_repository`, `get_tag_repository`, `get_item_service`, `get_collection_service`
   and `get_tag_service`.
8. `backend/src/domain/exceptions.py` — drop `ItemNotFoundError`, `CollectionNotFoundError` and
   `DuplicateCollectionNameError`. `Tag` adds none of its own: `POST /tags` is idempotent by
   construction, so it has no conflict path to raise one for.
9. `backend/src/adapters/inbound/middleware/error_handler.py` — drop those three entries from
   `_STATUS_CODES`. Leaving them behind is an import error, not a silent one, so this step announces
   itself.

**Frontend — delete**

10. `rm -rf frontend/src/features/example/`.
11. Delete the example pages under `frontend/src/app/pages/`: `ItemsPage.tsx`, `ItemDetailPage.tsx`,
    `ItemFormPage.tsx`, `CollectionsPage.tsx`, `CollectionDetailPage.tsx` and
    `CollectionFormPage.tsx`.

**Frontend — edit**

12. `frontend/src/app/router.tsx` — drop the `/items*` and `/colecciones*` route objects (list,
    detail, `/items/nuevo`, `/items/:id/editar`, `/colecciones/nueva`, `/colecciones/:id/editar`)
    and their `lazy()` imports.
13. `frontend/src/components/layout/navigation.ts` — the one navigation config that the `Sidebar`,
    the `MobileTabBar` and the account panel render from. Drop the `catalog` entry (which is also
    the mobile «Catálogo» tab), the whole `collections` group («Ver colecciones», «Colecciones
    destacadas») and the `my-items` entry of the `account` group, plus the imports and icons they
    leave unused. The `Sidebar` and the mobile surfaces need no edit of their own.
14. `frontend/src/components/layout/useNavEntryActive.ts` — remove the `catalog` and `mine` rules,
    which only exist for the two entries that share `/items`. They are the only values of the
    `active` union (`NavActiveRule`) in `navigation.ts`, so the type and the `active` field go with
    them and the hook is left with its final `matchPath` line.
15. `frontend/src/app/pages/HomePage.tsx` — drop the link to the catalogue.
16. Update the tests that assert on what was removed: `navigation.test.ts` (which also imports
    `MY_ITEMS_PATH`), `Sidebar.test.tsx`, `MobileTabBar.test.tsx`, `MobileAccountDrawer.test.tsx`,
    `useNavEntryActive.test.tsx` and `HomePage.test.tsx`. In `navigation-parity.test.tsx` lower the
    two sanity thresholds (`toBeGreaterThanOrEqual(5)` links and `(3)` inactive entries in the
    `Sidebar`): without the sample the `Sidebar` keeps 2 links (Inicio, Componentes UI) and 2
    inactive entries (Mensajes, Ajustes; «Editar perfil» is panel-only).
17. Delete `frontend/src/lib/paths.ts` and `paths.test.ts` (`ITEMS_PATH`, `MY_ITEMS_PATH`,
    `isMineView`), last, because four files import it: `ItemsPage.tsx` (deleted in step 11),
    `navigation.ts` (step 13), `useNavEntryActive.ts` (step 14) and `navigation.test.ts`
    (step 16).

**Seed — unwire**

18. `Makefile` — drop the `seed` target, its `.PHONY` entry and its `help` line, and the mentions of
    the seed in the comments of `test` and `test-e2e`.
19. `scripts/setup.py` — `migrate_and_seed()` is left running the migrations alone; drop the
    `--no-seed` option and the mentions of the seed. `make setup` calls `seed.py`, so it fails
    without this step.
20. `backend/pyproject.toml` — drop `faker` from the dev extra and `seed.py` from
    `[tool.coverage.run] omit`. Delete `.claude/agents/db-seeder.md`, whose only job is that file,
    and drop `make seed` from the prose that mentions it (`git grep -n "make seed"`).
21. `frontend/e2e/tests/auth.spec.ts` — it logs in as `viewer@example.com`, a seeded account. Point
    it at an account of your own, or delete it with the sample.

Then `make lint && make test` must pass, and the backend must still start with auth and health
alone. `make lint` and `make test` do not run the E2E specs, so step 21 does not announce itself.

A database that was already migrated keeps the seeded accounts and the sample's tables, and its
`alembic_version` points at the revision step 5 deleted. Recreate the development volume
(`docker compose --env-file ../.env --profile prod down -v` from `infra/`, which deletes **all** its
data), then `make dev` and `make migrate`. After that there are no accounts: the first
user is created through registration. The form always creates a `viewer`; any other role is passed
to `POST /auth/register` until the project closes it
(`docs/adr/0003-roles-y-registro-abierto.md`).

## One thing that looks like a step and is not

**`frontend/src/lib/api-client.test.ts` mentions `/items`.** It is template code, and the path is an
arbitrary URL string used to exercise the HTTP client. It is not a dependency on the sample, and it
must not be deleted — but a sweep that greps for `items` will flag it, so it is listed here to save
the next person the investigation.

## The cost, and keeping it that way

Twenty-one steps, four of them only to unwire the seed. That number is the budget. If adding to the
sample would push it higher, the sample is reaching into the template and the reach is the thing to
fix — not the procedure.
