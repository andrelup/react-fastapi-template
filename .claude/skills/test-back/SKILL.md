---
name: test-back
description: Writes and runs the backend tests (pytest). Decides whether a unit, integration or API test is needed based on the hexagonal layer that changed, writes the tests following AAA, and verifies the 80% minimum coverage. Use after implementing or modifying code in backend/, or when the user asks for backend tests.
---

# Backend tests

Write tests for the code in `backend/` following the project conventions, and verify that the suite passes with coverage ≥ 80%.

## Step 1 — Identify what is being tested

Determine which files under `backend/src/` are the target: the ones modified in the current conversation, the ones the user named, or (if there is no context) the ones changed according to `git diff` / `git status`.

## Step 2 — Decide the test type based on the layer

The test type follows from the hexagonal layer. A single change may require tests in more than one layer:

| Layer modified | Test type | Location | Strategy |
|---|---|---|---|
| `domain/services/`, `domain/models/` | Unit | `tests/unit/` | Mock the ports (Protocol classes). No DB, no FastAPI, no I/O. |
| `adapters/outbound/persistence/` | Integration | `tests/integration/` | Real test DB (fixture from `conftest.py`). Verify the repository against PostgreSQL. |
| `adapters/inbound/api/` (routers, schemas, middleware) | API | `tests/api/` | `httpx.AsyncClient` against the FastAPI app. Verify status codes, the `{"success", "data", "error"}` format, and schema validation. |

Decision rules:

- A new endpoint normally needs **two** tests: a unit test for the domain service logic + an API test for the router. The router carries no logic, so its test covers wiring, validation and error translation (404, 401, 422).
- A new repository needs an **integration** test; do not mock SQLAlchemy in a unit test to "cover" a repository.
- Domain exceptions are tested at the unit level (that the service raises them) and at the API level (that the middleware translates them to the right HTTP status).
- `config/` and `main.py` do not need dedicated tests unless they carry logic of their own.

## Step 3 — Write the tests

- AAA pattern with explicit `# Arrange`, `# Act`, `# Assert` comments.
- Reuse fixtures from `tests/conftest.py` (test DB, async client, authenticated customer/seller users). If a clearly reusable fixture is missing, add it to `conftest.py` rather than duplicating it in the test file.
- `pytest-asyncio` for everything async.
- Descriptive names: `test_<function>_<scenario>_<result>` (e.g. `test_find_by_id_when_book_missing_returns_none`).
- Code and identifiers in English. Type hints mandatory (mypy strict applies to tests too).
- Cover the happy path, the domain error cases and the validation edges — not just the happy path.

## Step 4 — Run and verify

From `backend/`:

```
pytest --cov=src --cov-report=term-missing
```

- If there are failures: diagnose and fix (the test if it is poorly framed, the code if the test reveals a bug — in that case tell the user about the bug found).
- If coverage of the modules touched drops below 80%: add cases for the uncovered lines that `term-missing` reports, prioritizing error branches.
- Integration/API tests need the test DB up; if the connection fails, bring the environment up with `make dev` (from the root) before retrying.

## Step 5 — Report

Summarize for the user: tests added by type, suite result, and final coverage as a table, which is more visual. If something was deliberately left uncovered, say so explicitly.
