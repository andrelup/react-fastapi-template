---
name: commit
description: Creates project commits following Conventional Commits, always with the message in English and with the module scope (backend, frontend, infra, ci). Groups changes into atomic commits, checks that no secrets or unwanted files slip in, and lets the pre-commit hooks pass. Use when the user asks to commit, save changes, or get the branch ready for a PR.
---

# Project commits

Create one or more commits from the pending changes. **The message is always in English**, even though the conversation with the user is in Spanish.

## Step 1 — Inspect the state

Run in parallel:

```
git status
git diff            # unstaged changes
git diff --staged   # already-staged changes
git log --oneline -10
```

The `git log` is there to match the repo's recent message style, not to copy it blindly.

This repository is a template offered to the community: once published, contributors are expected to follow the issue-driven, one-branch-per-feature workflow described in CLAUDE.md. Until then, while the sole author is building the template itself, commit directly on `master` — do not create a feature branch or block the commit just because the current branch is `master`/`main`.

## Step 2 — Group into atomic commits

Each commit must be a coherent unit that can be reviewed on its own. If the diff mixes independent things (a backend feature + a frontend fix + tooling), make **several commits** with selective `git add` instead of a single one.

Do not mix in the same commit:

- Code from `backend/` and from `frontend/` — they are independent projects and the scope must reflect that.
- A functional change with a broad refactor or an automatic reformat.
- Tests covering pre-existing code together with a new feature (though tests + code for the same feature do belong together).

## Step 3 — Write the message

Format: `<type>(<scope>): <subject>`

**Types** (the project's): `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.

**Scope**: the module touched — `backend`, `frontend`, `infra`, `ci`. It can be narrowed when that adds value (`feat(backend): ...`). If the commit is cross-cutting across the monorepo, the scope may be omitted.

**Subject**:

- In English, lowercase initial, no trailing period.
- Present imperative: `add`, `fix`, `rename` — never `added`, `adds`, `adding`.
- At most ~72 characters.
- Describe **what changes and why**, not the files touched. `fix(backend): chain books migration after users` ✔ / `fix: update alembic file` ✘.

**Body** (optional, after a blank line): only if the *why* does not fit in the subject — a design decision, a trade-off, context a reviewer would need. Do not restate the diff in prose.

**Issue references**: if the work corresponds to an issue, append it to the subject, the way the repo does it: `feat(backend): add books CRUD API router with pagination and RBAC (#7)`.

Close the message with the trailer:

```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Valid examples from the repo:

```
feat(backend): add optimistic locking to Book and FavouriteList (#42)
test(backend): cover customer favourite lists
docs(backend): add hexagonal architecture guide
fix(frontend): fix login redirect
```

## Step 4 — Verify before committing

Before `git commit`, review what you are about to stage:

- **Never** stage `.env`, credentials, tokens, API keys or database URLs. If they show up in the diff, **stop and tell the user**. If the variable is new, what gets versioned is `.env.example` with an example value.
- No debug `print()`, no forgotten `console.log`, no `.only` in tests, no commented-out code.
- Do not add generated files, build artifacts, or temporary files from your own work.
- Confirm that the tests for the module touched pass if the change is functional (`make test-back` / `make test-front`).

## Step 5 — Commit

Use a heredoc for the message, so that the body and the trailer keep their line breaks:

```bash
git add <specific paths>
git commit -m "$(cat <<'EOF'
feat(backend): add book search endpoint

Search runs on the persistence adapter to avoid loading the full
catalog into memory.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

Use `git add .` only once you have confirmed that **everything** in the working tree belongs to that commit.

If a **pre-commit hook fails**: fix the cause and try again. Never use `--no-verify` (CLAUDE.md explicitly forbids it). If the hook reformats files, re-stage them and repeat the commit.

If the hook modifies the tree or the commit fails, check `git status` before retrying; do not create duplicate commits.

## Step 6 — Report

Show the user `git log --oneline -n <commits created>` and one sentence per commit explaining what it groups. **Do not `git push` and do not open a PR unless the user asks.**
