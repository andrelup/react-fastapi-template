# react-fastapi-template — Development Documentation

Reference documentation for working on this codebase. It describes the architecture **as it is
implemented today** and the rules that new code must follow, derived from a detailed reading of the
existing source rather than from intentions.

Read the document for the layer you are about to touch **before** writing code.

## Both stacks

| Document | Read it when |
|---|---|
| [Adding a Feature End to End](./adding-a-feature.md) | Adding a whole domain slice, backend and frontend. The executable walkthrough: domain model → port → service with the authorization → repository → migration → router → per-operation schemas → the three test tiers → frontend feature → route and screen. Also the `example/` folder convention and how to delete the sample domain. |

The short architecture decisions behind it live in `backend/docs/`:
[why hexagonal](../backend/docs/por-que-hexagonal.md),
[why `Protocol` and not ABC](../backend/docs/por-que-protocol-y-no-abc.md),
[why the `ApiResponse` envelope](../backend/docs/por-que-el-envelope-apiresponse.md).

## Frontend — `frontend/`

| Document | Read it when |
|---|---|
| [Frontend Architecture](./frontend-architecture.md) | Adding a feature, a route, or any call to the backend. Layer rules, routing, data access, state, and a step-by-step recipe for a new feature. |
| [UI Components and Design Rules](./frontend-ui-components.md) | Building any screen. The component catalogue, design tokens, colour and typography policy, responsive and accessibility rules. |
| [Code Style](./frontend-code-style.md) | Always. ESLint, Prettier and the strict TypeScript settings, and what they forbid. |
| [Testing](./frontend-testing.md) | Every change. Vitest + React Testing Library conventions and copy-paste templates. |

The live component catalogue is the app itself, at the route **`/components-ui`**.

## Backend — `backend/`

| Document | Read it when |
|---|---|
| [Hexagonal Architecture](./backend-hexagonal-architecture.md) | **Always, before any backend change.** The dependency rule, ports and adapters, domain models, error handling, and the end-to-end recipe for a new use case. |
| [Database Access with SQLAlchemy](./backend-database-sqlalchemy.md) | Reading or writing data. ORM models, sessions and transactions, query patterns, migrations. |
| [Code Style](./backend-code-style.md) | Always. Ruff rule families and mypy strict, and what they demand. |
| [Testing](./backend-testing.md) | Every change. The three test tiers, fixtures, fakes and templates. |
| [Logging](./backend-logging.md) | Adding any log line, or touching the logging config or the request middleware. The structlog pipeline, `request_id` correlation through contextvars, and the rules a log line must follow. |

## Ground rules that apply to both stacks

- **Code in English.** Documentation splits by audience: Spanish for what humans read (the four
  `README.md` files and the ADRs under `backend/docs/`), English for what agents read (`CLAUDE.md`,
  this `docs/` tree, `.claude/`). UI copy is in Spanish.
- **Types are mandatory**: mypy strict in the backend, TypeScript strict in the frontend.
- **Everything is tested.** Project minimum coverage: 80 %.
- **Conventional Commits** with a module scope: `feat(backend): …`, `fix(frontend): …`.
- **One branch per issue**, PR against `main`, linked to the issue with a closing keyword. There is
  no `develop` branch.
- Never commit without the pre-commit hooks passing; never commit a secret.
- `backend/` and `frontend/` are independent projects joined by a REST API — they never import each
  other.

See the root `CLAUDE.md` and the per-stack `backend/CLAUDE.md` and `frontend/CLAUDE.md` for the
agent-facing summaries of the same rules.
