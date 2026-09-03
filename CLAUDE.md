# react-fastapi-template — AI-powered bookstore

Monorepo with a Python backend and a React frontend. Training project on Claude Code and agentic development.

## Repository structure

```
react-fastapi-template/
├── backend/          # REST API — Python 3.12, FastAPI, Hexagonal Architecture
├── frontend/         # SPA — React 18, TypeScript, Bulletproof React Architecture
├── infra/            # Docker Compose — PostgreSQL 16 + pgvector
├── .claude/          # Subagents and slash commands
├── .github/          # GitHub Actions workflows
└── Makefile          # Unified project commands
```

Each subdirectory (`backend/`, `frontend/`) has its own CLAUDE.md with conventions specific to its stack. This file only contains shared global rules.

## Documentation — `docs/`

`docs/` holds the detailed rules for each layer, written from the real code. **Read only the document that matches the task at hand — never load them all.** One or two are enough for any single task; loading the rest just wastes context.

| Before you… | Read |
|---|---|
| Add or change a frontend feature, route, or backend call | `docs/frontend-architecture.md` |
| Build or restyle any UI/screen | `docs/frontend-ui-components.md` |
| Debug a frontend lint/format/type error | `docs/frontend-code-style.md` |
| Write frontend tests | `docs/frontend-testing.md` |
| Touch **anything** in `backend/src/` | `docs/backend-hexagonal-architecture.md` |
| Read or write data, add an entity, write a migration | `docs/backend-database-sqlalchemy.md` |
| Debug a ruff/mypy failure | `docs/backend-code-style.md` |
| Write backend tests | `docs/backend-testing.md` |

`docs/README.md` is the index; consult it only if the table above does not resolve which document applies.

## Global conventions

- Code language: English (variables, functions, classes, comments)
- Documentation language: Spanish
- Type hints / strict types are mandatory in both stacks
- All code must have tests. Minimum coverage: 80%

## Git

- Conventional commits are mandatory: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`
- The commit scope indicates the module: `feat(backend): add book search endpoint`, `fix(frontend): fix login redirect`
- One branch per feature: `feature/short-name`
- PRs against `main`, always with passing tests

### Issue-driven workflow

Every task originates from a GitHub issue. Always link the work back to the issue so closing it also closes the PR and deletes the branch automatically:

- Create the feature branch from the issue (e.g. `gh issue develop <issue-number> --checkout`) so the branch is linked to the issue
- When opening the PR, link it to the issue with a closing keyword in the PR body (`Closes #<issue-number>`) so merging the PR closes the issue, and closing the issue removes the associated PR and branch

## Docker

- `docker-compose.yml` in `infra/` brings up the whole environment
- Services: PostgreSQL 16 + pgvector, FastAPI backend
- Multi-stage Dockerfiles in each subdirectory (`backend/Dockerfile`, `frontend/Dockerfile`)
- Hot reload enabled in development via volumes

## Makefile (root)

All commands run from the monorepo root:

```
make setup        → getting started: venv, deps, hooks, DB, migrations, seed
make dev-back     → backend on the host with hot reload (port 8000)
make dev-front    → frontend on the host with hot reload (port 3000)
make db-up        → only PostgreSQL in Docker, detached
make dev          → docker compose up (whole environment)
make test         → backend + frontend tests
make test-back    → backend tests only
make test-front   → frontend tests only
make test-e2e     → playwright tests
make lint         → backend + frontend linters
make migrate      → alembic upgrade head
make seed         → data seeding script
make build        → docker build of both images
```

## Secrets and configuration

- Environment variables in `.env` (not versioned)
- `.env.example` is versioned, with every required variable and example values
- Never hardcode secrets, database URLs, API keys or tokens in the code

## CI/CD

- GitHub Actions in `.github/workflows/`
- Pipeline: lint → test-backend → test-frontend → test-e2e → build → security-scan
- Quality gate: linters, strict types and coverage thresholds as required checks

## What NOT to do

- Do not import code directly between `backend/` and `frontend/` — they are independent projects connected by a REST API
- Do not install global dependencies — each subdirectory manages its own
- Do not commit without the pre-commit hooks passing
- Do not use `print()` for debugging — use the configured logging system (structlog in the backend)
