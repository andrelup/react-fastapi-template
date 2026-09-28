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
purpose — a router registration, a couple of providers, a nav link. They are edited, not deleted,
and they are enumerated in the procedure.

## Deleting it

This is what `scripts/init-template.sh --no-example` automates (issue #14, not written yet). Done by
hand, in this order:

**Backend — delete**

1. `rm -rf` each of the six backend `example/` directories listed above.
2. Delete the twelve test files listed above. `backend/tests/fakes/` is then empty except for its
   `__init__.py`; leave the package, it is where the next fake with two consumers goes.
3. `rm backend/seed_example.py`, and remove the marked block at the end of `backend/seed.py` that
   calls it — marked in the style of `alembic/env.py:17-20`, with the same
   `(issue #14, --no-example)` parenthetical.

**Backend — edit**

4. `backend/alembic/env.py` — delete the marked import:
   `from src.adapters.outbound.persistence import example  # noqa: F401`, which carries the comment
   saying so.
5. `backend/alembic/versions/d5d3e24a6992_create_initial_schema.py` — remove the `items`,
   `collections`, `tags`, `item_tags` and `item_collections` tables from `upgrade()` and their drops
   from `downgrade()`. The revision is shared with the template's `users` table, so it is edited,
   never deleted.
6. `backend/src/main.py` — drop `include_router(item_router)`, `include_router(collection_router)`
   and `include_router(tag_router)`, and their imports.
7. `backend/src/config/container.py` — drop the six providers: `get_item_repository`,
   `get_collection_repository`, `get_tag_repository`, `get_item_service`, `get_collection_service`
   and `get_tag_service`.
8. `backend/src/domain/exceptions.py` — drop `ItemNotFoundError`, `DuplicateSlugError`,
   `CollectionNotFoundError` and `DuplicateCollectionNameError`. `Tag` adds none of its own: `POST
   /tags` is idempotent by construction, so it has no conflict path to raise one for.
9. `backend/src/adapters/inbound/middleware/error_handler.py` — drop those four entries from
   `_STATUS_CODES`. Leaving them behind is an import error, not a silent one, so this step announces
   itself.

**Frontend — delete**

10. `rm -rf frontend/src/features/example/`.
11. Delete `frontend/src/app/pages/ItemsPage.tsx` and `frontend/src/app/pages/ItemDetailPage.tsx`.

**Frontend — edit**

12. `frontend/src/app/router.tsx` — drop the `/items` and `/items/:id` route objects and their
    `lazy()` imports.
13. `frontend/src/components/layout/Sidebar.tsx` — drop the catalogue `NavLink`, and
    `frontend/src/app/pages/HomePage.tsx` — drop the link to the catalogue. Update
    `Sidebar.test.tsx` and `HomePage.test.tsx`, which assert on both.

Then `make lint && make test` must pass, and the backend must still start with auth and health
alone.

## Two things that look like steps and are not

**`backend/seed.py` seeds users only; `backend/seed_example.py` seeds the sample catalogue.** Issue
#12 split what used to be a single script in two: `seed.py` still creates accounts and nothing else,
and delegates the catalogue — collections, items, tags — to `seed_example.py`, which it calls from a
marked block at its own end, in the style of `alembic/env.py:17-20` and closed with the same
`(issue #14, --no-example)` parenthetical. That is why step 3 above exists now: there is a file to
delete and a call to remove, where before there was neither. Older versions of this procedure said
`seed.py` needed no step at all; issue #12 is why that stopped being true.

**`frontend/src/lib/api-client.test.ts` mentions `/items`.** It is template code, and the path is an
arbitrary URL string used to exercise the HTTP client. It is not a dependency on the sample, and it
must not be deleted — but a sweep that greps for `items` will flag it, so it is listed here to save
the next person the investigation.

## The cost, and keeping it that way

Thirteen steps, of which five are deletions and eight are small edits to template files. That number
is the budget. If adding to the sample would push it higher, the sample is reaching into the
template and the reach is the thing to fix — not the procedure.
