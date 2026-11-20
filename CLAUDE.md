# react-fastapi-template — full-stack project template

Monorepo with a Python backend and a React frontend, using a generic catalogue (items, collections, tags) as its example domain. Training project on Claude Code and agentic development.

## Repository structure

```
react-fastapi-template/
├── backend/          # REST API — Python 3.12, FastAPI, Hexagonal Architecture
├── frontend/         # SPA — React 18, TypeScript, Bulletproof React Architecture
├── infra/            # Docker Compose — PostgreSQL 16 (dev) + production stack
├── .claude/          # Subagents and slash commands
├── .github/          # GitHub Actions workflows
└── Makefile          # Unified project commands
```

Each subdirectory (`backend/`, `frontend/`) has its own CLAUDE.md with conventions specific to its stack. This file only contains shared global rules.

## Documentation — `docs/`

`docs/` holds the detailed rules for each layer, written from the real code. **Read only the document that matches the task at hand — never load them all.** One or two are enough for any single task; loading the rest just wastes context.

| Before you… | Read |
|---|---|
| Add a whole domain slice end to end (backend **and** frontend) | `docs/adding-a-feature.md` — the `add-feature` skill triggers on this task and indexes it |
| Add or change a frontend feature, route, or backend call | `docs/frontend-architecture.md` |
| Build or restyle any UI/screen | `docs/frontend-ui-components.md` |
| Debug a frontend lint/format/type error | `docs/frontend-code-style.md` |
| Write frontend tests | `docs/frontend-testing.md` |
| Touch **anything** in `backend/src/` | `docs/backend-hexagonal-architecture.md` |
| Read or write data, add an entity, write a migration | `docs/backend-database-sqlalchemy.md` |
| Debug a ruff/mypy failure | `docs/backend-code-style.md` |
| Write backend tests | `docs/backend-testing.md` |
| Add a log line, or touch the logging config or middleware | `docs/backend-logging.md` |
| Work on the sample catalogue, or remove it | `docs/the-example-domain.md` |
| Record an architecture decision, or look up why one was taken | `docs/adr/README.md` — numbered ADRs, written in Spanish |

`docs/README.md` is the index; consult it only if the table above does not resolve which document applies.

## Global conventions

- Code language: English (variables, functions, classes, comments)
- Documentation language, by audience: **Spanish** for what humans read — the four `README.md` files, the ADRs in `docs/adr/` and the guide in `backend/docs/`; **English** for what agents read — `CLAUDE.md`, the rest of `docs/` and `.claude/`. UI copy is Spanish
- Core versus example: the template's permanent core is the architecture (hexagonal backend, Bulletproof React frontend), the styles and design tokens, and auth (login, register). The sample catalogue (items, collections, tags) and the navigation entries that point at it are a replaceable example. Each layer keeps it in an `example/` folder (`backend/src/domain/services/example/`, `frontend/src/features/example/`, …); the dependency runs example → core, never the reverse, and the few core files that wire the sample in are listed in the removal procedure of `docs/the-example-domain.md`, which also explains the convention
- Type hints / strict types are mandatory in both stacks
- All code must have tests. Minimum coverage: 80%

## Git

- Conventional commits are mandatory: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `ci:`
- The commit scope indicates the module: `feat(backend): add the item search endpoint`, `fix(frontend): fix login redirect`
- One branch per issue, created with `gh issue develop <n> --checkout` so it stays linked to the issue. The name it generates (`<n>-<slugified-title>`) is the convention — do not rename it
- PRs against `main`, always with passing tests. There is no `develop` branch

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

- Docker is used for exactly two things: **PostgreSQL in development**, and the
  **images that actually ship**. There is no containerised development
  environment — the backend and the frontend run natively on the host, which is
  where hot reload actually works and where the source tree is not mounted into
  a container (that mount is an isolation hole: code running in the container
  writes to your working copy)
- `infra/docker-compose.yml` holds all three services. `postgres` has no
  profile, so a plain `up` starts only the database; `backend` and `frontend`
  sit behind the `prod` profile
- Multi-stage Dockerfiles in each subdirectory (`backend/Dockerfile`,
  `frontend/Dockerfile`), production-only: no development stage
- The production images run as a non-root user and declare a `HEALTHCHECK`. The
  frontend keeps port 80 by granting the nginx binary `CAP_NET_BIND_SERVICE`
  instead of running its master process as root
- `VITE_API_URL` is a **build arg**, not a runtime variable: Vite bakes the API
  URL into the bundle at build time. It has no default anywhere, so a plain
  `docker build ./frontend` without `--build-arg VITE_API_URL=…` fails on purpose
- No address has a default in the compose file: the API URL, the CORS origins
  and the DB port use `${VAR:?…}`, like the credentials. Compose interpolates
  the whole file before doing anything, so every command needs a complete
  env-file, even `make build`. The backend service's `DB_HOST: postgres` stays
  fixed: it is the service name on the Docker network
- The images have fixed names, `fastapi-template` and `react-template`, tagged
  `${IMAGE_TAG:-latest}`; only `make build ENV=<env>` changes the tag
- `docker compose down` does **not** stop services that belong to a profile —
  `--profile prod` is required. There is no Make target for stopping: it is run
  by hand from `infra/`
  (`docker compose --env-file ../.env --profile prod down`)

## Makefile (root)

All commands run from the monorepo root, on the developer's machine. None of them deploys
anything (see Deployment below):

```
make setup        → getting started: venv, deps, hooks, DB, migrations, seed
make dev-back     → backend on the host with hot reload (port 8000)
make dev-front    → frontend on the host with hot reload (port 3000)
make dev          → only PostgreSQL in Docker, detached; then run dev-back / dev-front on the host
make preview      → build and run the production stack locally with .env, detached (smoke test)
make test         → backend (pytest) + frontend (vitest) tests
make test-back    → backend tests only (pytest)
make test-front   → frontend tests only (vitest)
make test-e2e     → playwright tests (needs the API running and the DB seeded)
make lint         → backend + frontend linters
make migrate      → alembic upgrade head
make seed         → data seeding script
make build        → build both images through compose with .env, tagged :latest (no run)
make build ENV=x  → same with .env.x, tagged :x — never run locally, never pushed
```

`make dev`, `make preview` and every other target always read `.env`; only `make build` takes
`ENV`. Images built for another environment only prove that the build works with its values:
running them locally would make the browser call that environment's API, whose CORS rejects
`localhost`.

## Secrets and configuration

- Environment variables in `.env` (not versioned), the single config file for the backend, Vite
  (`envDir` points at the repo root) and compose. Other environments get `.env.staging` and
  `.env.prod`, never versioned either; never `.env.production`, which Vite would load by itself
- `.env.example` is versioned, with every required variable and example values; the required
  ones are marked `OBLIGATORIA`. `make setup` warns when an existing `.env` lacks one of its keys
- No defaults for addresses: the API URL, the CORS origins and the DB host and port are required
  in `backend/src/config/settings.py`, `frontend/src/lib/env.ts` (checked by `vite.config.ts`
  before `vite`, `vite build` or `vitest` start) and the compose file. A missing one stops the
  platform with a message naming it, instead of falling back to `localhost`
- Never hardcode secrets, database URLs, API keys or tokens in the code

## CI/CD

- GitHub Actions in `.github/workflows/`, one workflow per stack with `paths:`
  filters so a frontend-only PR never runs the backend suite
- `ci-backend.yml`: `lint` (ruff check, ruff format --check, mypy --strict)
  → `test-backend` (PostgreSQL 16 service, `alembic upgrade head`,
  `pytest --cov=src`)
- `ci-frontend.yml`: `lint` (eslint, prettier, tsc --noEmit)
  → `test-frontend` (vitest with coverage)
- CI reads nobody's `.env`. Its values, all fake, come from the Actions secret
  `CI_DOTENV`, which holds a whole `.env` and is created by hand by the
  maintainer, never by an agent. `test-backend` and `test-frontend` write it to
  the root `.env` and fail with a clear error if it is missing. Dependabot PRs
  (#16) cannot read Actions secrets: the same secret must also exist under
  Dependabot secrets
- Quality gate: linters, strict types and coverage thresholds. Thresholds live
  in each project's config (`backend/pyproject.toml` →
  `[tool.coverage.report] fail_under = 80`; `frontend/vite.config.ts` →
  `coverage.thresholds`), never in the workflow YAML
- `security.yml` (`security-scan`), with no `paths:` filter because a secret or
  a vulnerable pattern can land in any file. Runs on PRs, on pushes to `main`
  and monthly (cron `17 6 1 * *`). Four jobs: `codeql` (python and
  javascript-typescript matrix) then `codeql-gate` (fails on open critical or
  high CodeQL alerts of the analysed ref, read from the code scanning API;
  dismissing an alert in the Security tab is how a false positive is accepted),
  `gitleaks` (CLI pinned by release and sha256, whole history, `--redact`) and
  `trivy` (filesystem scan plus both images). Everything lands in the Security
  tab as SARIF. The `trivy` job builds both images with plain `docker build`, so
  it is the only CI check on the Dockerfiles. It needs no `.env` and no
  `CI_DOTENV`
- Third-party actions in `security.yml` are pinned by full commit SHA with a
  version comment, and Trivy's binary is pinned too (`TRIVY_VERSION`). Never
  move them to a tag or to `latest`: `trivy-action` was compromised in March
  2026 (GHSA-69fq-xp46-6x23). A finding is fixed, never hidden: no
  `.trivyignore` without the maintainer's approval
- GitHub disables scheduled workflows in a public repository after 60 days
  without repository activity, and the scheduled run does not count as activity.
  Re-enable it from the Actions tab or with `gh workflow enable`. Failure
  notifications of the scheduled run go to whoever last edited its `cron` line:
  email under Settings > Notifications > System > Actions (email on, "Only
  notify for failed workflows"); mobile under GitHub Mobile > Settings >
  Configure Notifications > Actions push, failures only
- E2E exists (`make test-e2e`, Playwright) but does NOT run in CI: it needs a live
  API and a seeded database
- Not planned, on purpose: branch protection (#23), because the project has a
  single maintainer who pushes to `main` directly; and publishing images to GHCR
  (#22), because nothing deploys them

## Deployment

The template deploys nothing. Until it becomes a real project, the job is to make that move
smooth: production-grade images, configuration that comes from each environment's `.env`, and CI
that checks the images build.

- **`make` is local only.** Every target tests or runs the platform on the developer's machine,
  and none of them deploys, now or later. `make preview` is a smoke test, and `make build` only
  builds images, even when it builds them for another environment (#85)
- **Deploying will be CI's job.** When a project created from the template goes public, that
  project adds a deploy workflow: publishing the images and releasing them to its platform. Until
  then, no Make target, script or workflow in this repo deploys or publishes anything

## What NOT to do

- Do not import code directly between `backend/` and `frontend/` — they are independent projects connected by a REST API
- Do not install global dependencies — each subdirectory manages its own
- Do not commit without the pre-commit hooks passing
- Do not add a Make target, script or workflow step that deploys or publishes images — see Deployment
- Do not use `print()` for debugging — use the configured logging system (structlog in the backend; see `docs/backend-logging.md`)
