---
name: add-feature
description: Use when adding a new domain entity, resource or vertical slice to this template end to end — a new CRUD, a new endpoint together with the screen that consumes it, or any feature that has to touch both backend/ and frontend/ — including when only planning it (e.g. «añade la entidad X de punta a punta», «un CRUD de reseñas», «un endpoint con su pantalla»).
---

# Add a feature end to end

This skill is a trigger and an index, not a rulebook. The rules live in `docs/adding-a-feature.md`
and in the per-stack documents it links. Read each section when the step below reaches it, and work
from the document, never from a summary of it.

## 1. Before any code

1. Read `docs/adding-a-feature.md` §0–§1: how the branch is set up, and whether the two halves are
   built one after the other or in parallel.
2. Decide the authorization shape with §2, and write the permission matrix down.
3. Settle what crosses the wire with §3, and write it into the issue before building either half.

## 2. While building — read only the stack you are in

| Building | Recipe | Read only if the task needs it |
|---|---|---|
| Backend | `docs/backend-hexagonal-architecture.md` §6 | `docs/backend-database-sqlalchemy.md`, `docs/backend-testing.md` |
| Frontend | `docs/frontend-architecture.md` §7 | `docs/frontend-ui-components.md`, `docs/frontend-testing.md` |
| Where they meet | `docs/adding-a-feature.md` §4 | §5 when the entity is not a plain row |

## 3. Where an afternoon usually goes — read the section before you get there

| When you are about to… | Read first |
|---|---|
| add a domain exception | `docs/backend-hexagonal-architecture.md` Rule 5 and step 11 of §6 (`_STATUS_CODES` in `backend/src/adapters/inbound/middleware/error_handler.py`) |
| declare a literal route next to a parametrised one | `docs/adding-a-feature.md` §4 |
| write the `save()` of a versioned entity | `docs/backend-database-sqlalchemy.md` §4, the **Update** pattern (`attributes.set_committed_value`) |

## 4. Gates

The same set CI runs, from the repository root. Fix what they report before moving on:

```
make lint                                 # ruff check + mypy, eslint
make test-back                            # pytest, with the backend's 80 % coverage gate
npm --prefix frontend run format:check    # prettier
npm --prefix frontend run typecheck       # tsc --noEmit
npm --prefix frontend run test:coverage   # vitest, with the frontend's 80 % thresholds
```

`ruff format` is not in `make lint`; the pre-commit hook applies it on commit.

## 5. Before the PR

Walk `docs/adding-a-feature.md` §6 item by item. Then open the PR against `main` with
`Closes #<n>`.
