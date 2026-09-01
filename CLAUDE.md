# BookShelf — AI-powered bookstore

Monorepo with a Python backend and a React frontend. Training project on Claude Code and agentic development.

## Repository structure

```
bookshelf/
├── backend/          # REST API — Python 3.12, FastAPI, Hexagonal Architecture
├── frontend/         # SPA — React 18, TypeScript, Bulletproof React Architecture
├── infra/            # Docker Compose, Prometheus, Grafana, SonarQube
├── .claude/          # Subagents and slash commands
├── .github/          # GitHub Actions workflows
└── Makefile          # Unified project commands
```

Each subdirectory (`backend/`, `frontend/`) has its own CLAUDE.md with conventions specific to its stack. This file only contains shared global rules.

## Global conventions

- Code language: English (variables, functions, classes, comments)
- Documentation language: Spanish
- Type hints / strict types are mandatory in both stacks
- All code must have tests. Minimum coverage: 80%

## Git

- Conventional commits are mandatory: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`
- The commit scope indicates the module: `feat(backend): add book search endpoint`, `fix(frontend): fix login redirect`
- One branch per feature: `feature/short-name`
- PRs against `develop`, always with passing tests

### Issue-driven workflow

Every task originates from a GitHub issue. Always link the work back to the issue so closing it also closes the PR and deletes the branch automatically:

- Create the feature branch from the issue (e.g. `gh issue develop <issue-number> --checkout`) so the branch is linked to the issue
- When opening the PR, link it to the issue with a closing keyword in the PR body (`Closes #<issue-number>`) so merging the PR closes the issue, and closing the issue removes the associated PR and branch

## Docker

- `docker-compose.yml` in `infra/` brings up the whole environment
- Services: PostgreSQL 16, FastAPI backend, React frontend (dev), Prometheus, Grafana
- Multi-stage Dockerfiles in each subdirectory (`backend/Dockerfile`, `frontend/Dockerfile`)
- Hot reload enabled in development via volumes

## Makefile (root)

All commands run from the monorepo root:

```
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
- SonarQube as the quality gate on PRs

## What NOT to do

- Do not import code directly between `backend/` and `frontend/` — they are independent projects connected by a REST API
- Do not install global dependencies — each subdirectory manages its own
- Do not commit without the pre-commit hooks passing
- Do not use `print()` for debugging — use the configured logging system (structlog in the backend)
