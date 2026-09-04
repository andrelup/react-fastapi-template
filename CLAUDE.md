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

### Merging is the user's job — never the agent's

**An agent must never merge a pull request or a branch.** No `gh pr merge`, no `git merge`, no
`gh pr merge --auto`, no merge through the API or the web UI, whatever the reason and however green
the checks are. The same goes for deleting the branch or the worktree afterwards: they are the
reviewer's evidence and they stay until the user says otherwise.

The reason is not stylistic: **the user reviews the code before it enters `main`**, and a merge
performed by the agent takes that review away. Passing CI is not a substitute for it.

An agent's work ends at the pull request: branch pushed, PR open, checks green, a summary of what
changed and what to look at. Then it stops and hands over the PR link.

Merge strategy is likewise the user's call. If asked to merge, ask which strategy first — `--rebase`
rewrites the commits onto `main` and erases the branch from the graph, `--merge` keeps the branch
visible, `--squash` collapses it into a single commit.

## Docker

- `docker-compose.yml` in `infra/` brings up the whole environment
- Services: PostgreSQL 16, FastAPI backend, Vite frontend
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
make test         → backend (pytest) + frontend (vitest) tests
make test-back    → backend tests only (pytest)
make test-front   → frontend tests only (vitest)
make test-e2e     → playwright tests (pending, not configured yet)
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

- GitHub Actions in `.github/workflows/`, one workflow per stack with `paths:`
  filters so a frontend-only PR never runs the backend suite
- `ci-backend.yml`: `lint` (ruff check, ruff format --check, mypy --strict)
  → `test-backend` (PostgreSQL 16 service, `alembic upgrade head`,
  `pytest --cov=src`)
- `ci-frontend.yml`: `lint` (eslint, prettier, tsc --noEmit)
  → `test-frontend` (vitest with coverage)
- Quality gate: linters, strict types and coverage thresholds. Thresholds live
  in each project's config (`backend/pyproject.toml` →
  `[tool.coverage.report] fail_under = 80`; `frontend/vite.config.ts` →
  `coverage.thresholds`), never in the workflow YAML
- NOT built yet, one issue each: e2e tests (#6), security scanning (#21),
  Docker/GHCR build (#22), branch protection and required checks (#23)

## What NOT to do

- Do not import code directly between `backend/` and `frontend/` — they are independent projects connected by a REST API
- Do not install global dependencies — each subdirectory manages its own
- Do not commit without the pre-commit hooks passing
- Do not use `print()` for debugging — use the configured logging system (structlog in the backend)
