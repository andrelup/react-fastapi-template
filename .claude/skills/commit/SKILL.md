---
name: commit
description: Creates project commits following Conventional Commits, always with the message in English and with the module scope (backend, frontend, infra, ci). Groups changes into atomic commits, checks that no secrets or unwanted files slip in, and lets the pre-commit hooks pass. Use when the user asks to commit, save changes, or get the branch ready for a PR.
---

# Project commits

Create one or more commits from the pending changes **The message is always in English**.

## Step 1 — Inspect the state

Run in parallel:

```
git status
git diff            # unstaged changes
git diff --staged   # already-staged changes
git log --oneline -10
```

The `git log` is there to match the repo's recent message style, not to copy it blindly.

The repository's integration branch is `main`. There is no `develop` and no `master` — never assume either exists.

`CLAUDE.md` describes an issue-driven workflow: one branch per issue, created with `gh issue develop <n> --checkout` so it stays linked, and a PR against `main` carrying `Closes #<n>`. Follow it — but **never create a branch on your own initiative**. If the current branch already belongs to the work being committed, commit there; if it does not, ask the user before starting a new one.

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
- Describe **what changes and why**, not the files touched. `refactor(backend): collapse the alembic history into one initial revision` ✔ / `refactor: update alembic file` ✘.

**Body** (optional, after a blank line): only if the *why* does not fit in the subject — a design decision, a trade-off, context a reviewer would need. Do not restate the diff in prose.

**Issue references**: if the work corresponds to an issue, append it to the subject, the way the repo does it: `feat(backend): add the item CRUD API router with pagination and RBAC (#36)`.

Close the message with the trailer:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

Valid examples from the repo:

```
feat(backend): add the neutral catalogue ORM models
test(backend): cover the neutral catalogue ORM conventions
refactor(backend): collapse the alembic history into one initial revision
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
feat(backend): add the item search endpoint

Search runs on the persistence adapter to avoid loading the full
catalogue into memory.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

Use `git add .` only once you have confirmed that **everything** in the working tree belongs to that commit.

If a **pre-commit hook fails**: fix the cause and try again. Never use `--no-verify` (CLAUDE.md explicitly forbids it). If the hook reformats files, re-stage them and repeat the commit.

If the hook modifies the tree or the commit fails, check `git status` before retrying; do not create duplicate commits.

## Step 6 — Report

Show the user `git log --oneline -n <commits created>` and one sentence per commit explaining what it groups. **Do not `git push` and do not open a PR unless the user asks.**

## Never merge

Merging is the user's job, always. **Do not run `gh pr merge`, `git merge`, `gh pr merge --auto`, or merge through the API or the web UI** — not when the checks are green, not when the PR only closes an issue you opened yourself, not when the user approved the plan that led to the PR. Approving a plan is not approving a merge.

The reason is that the user reviews the code before it reaches `main`. A merge done by the agent removes that review; a green pipeline does not replace it.

The same applies to what comes after: **do not delete the branch, the remote branch, or the worktree** once the PR is open. They are what the reviewer reads.

Your work ends at the pull request: commits made, branch pushed, PR open with `Closes #<issue>`, checks green. Report the PR link, what changed and what deserves a closer look, and stop there.

If the user explicitly asks you to merge, ask which strategy before doing it — the choice changes the history and is not yours to make:

- `--merge` keeps the branch visible as a fork in the graph
- `--rebase` replays the commits onto `main`: linear history, and the branch disappears from the graph
- `--squash` collapses the branch into a single commit, losing the split into atomic commits
