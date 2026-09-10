---
name: issue
description: Creates GitHub issues for the project with the gh CLI, following the repo's established structure (title with a conventional-commit prefix, and Descripcion / Tareas / Criterio de aceptacion sections). All issue content is written in Spanish; labels are picked from the ones that already exist in the repo. Use when the user asks to open, create, or draft an issue.
---

# Create a GitHub issue

Create one or more issues in the project's GitHub repo using `gh`.

**Language rule:** these instructions are in English, but *everything written to GitHub* — title, body, comments — must be in **Spanish**. Reply to the user in Spanish too.

## Step 1 — Gather context

Never invent the issue's content. Ground it in the repo before writing:

- Read the relevant code, and reference concrete symbols and paths (`error_handler.py`, `BookORM`, `backend/src/adapters/...`). The existing issues do this and it's what makes them actionable.
- If the issue comes from a code review, a failing test or a PR comment, capture the origin — it goes in the `## Referencia` section.
- If the request is vague ("crea un issue para mejorar el login"), ask the user what the concrete problem and the acceptance criterion are before creating anything.

Check what already exists so you don't file a duplicate:

```
gh issue list --state all --limit 30
gh label list
```

## Step 2 — Write the title

Format: `<type>(<scope>): <subject in Spanish>`

- Same conventional-commit types and scopes as commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci` — scope `backend`, `frontend`, `infra`, `ci`. The scope may be omitted when the issue is cross-cutting (e.g. `docs: retrospectiva final...`).
- The subject is a **Spanish** noun phrase describing the deliverable, not an imperative sentence. Lowercase after the colon, no trailing period.

Real examples from the repo:

```
feat(backend): sistema de versionado optimista en modelos SQLAlchemy
test(backend): alcanzar 80% de coverage en tests unitarios
chore(frontend): eslint y prettier en cada commit
```

## Step 3 — Write the body

Markdown, in Spanish, with these sections in this order:

```markdown
## Descripcion
<Current state and why it's a problem. 1-2 paragraphs. Name the affected
files/classes. Explain what breaks or what is missing today, not just what
you want to build.>

## Tareas
- [ ] <Concrete, verifiable step>
- [ ] <One per unit of work: model, migration, error mapping, tests...>

## Criterio de aceptacion
<A single observable statement: given this scenario, the system behaves
like this. It must be checkable by someone who didn't write the code.>

## Referencia
<Optional. Origin of the issue: code review of PR #40, related issue,
external doc. Omit the section entirely if there is nothing to reference.>
```

Rules for the body:

- `## Tareas` always starts unchecked (`- [ ]`); they get ticked as the work progresses.
- Include the tests as an explicit task — the project requires ≥80% coverage.
- **Never list environment variable names, secrets, tokens, DB URLs or API keys** in an issue. Refer to `.env` / `.env.example` generically.
- Don't paste large code blocks. Point at `file:line` instead.

## Step 4 — Pick labels

Only use labels that already exist (`gh label list`). Never create a new one without asking the user. Each issue normally carries two axes, plus an optional third:

| Axis | Labels | Rule |
|---|---|---|
| Phase | `fase-01` … `fase-06` | The project phase the work belongs to. Zero-padded — `fase-1` does not exist. |
| Module | `backend`, `frontend`, `infra`, `CI/CD`, `agente` | One or more, matching the title's scope. |
| Kind | `documentation`, `enhancement`, `bug`, `decision`, `gate` | Optional. `decision` marks work that needs a product call; `gate` marks work that blocks publication. |

There is no `semana-*` axis: those labels do not exist in this repo.

If you can't infer the phase from context, **ask the user** rather than guessing.

## Step 5 — Create the issue

Write the body to a file first and pass it with `--body-file`. Do **not** inline the body with `-b`: on this Windows/PowerShell setup that mangles the encoding, which is why older issues in the repo lost all their accents ("Descripcion", "Anadir").

```bash
gh issue create \
  --title "feat(backend): sistema de versionado optimista en modelos SQLAlchemy" \
  --body-file <scratchpad>/issue-body.md \
  --label fase-02 --label backend
```

Write `issue-body.md` in the session scratchpad directory, as UTF-8, never inside the repo. Spanish text keeps its accents (`Descripción`, `Añadir`, `Criterio de aceptación`).

Before running the command, show the user the title, the rendered body and the labels, and **wait for confirmation**. Creating an issue is outward-facing and hard to undo.

## Step 5b — Dependencies and sub-issues

Two conventions, and they are not interchangeable:

**A sibling that must land first** goes in a footer at the very end of the body, after a `---` rule:

```markdown
---

**Blocked by:** #9 (el cambio de dominio) y #11 (los roles genéricos)
```

**A piece of a larger epic** becomes a real GitHub sub-issue of the parent. The parent then shows the progress bar and the navigable breakdown, and closing a child updates it on its own. The REST endpoint takes the child's **database id**, not its issue number:

```bash
R="repos/andrelup/react-fastapi-template"
id=$(gh api "$R/issues/35" --jq .id)
gh api -X POST "$R/issues/9/sub_issues" -F sub_issue_id="$id"
```

Attach them **in dependency order**: the panel renders them in the order they were added, so the list doubles as the plan of execution. `gh api "$R/issues/9/sub_issues"` lists what is already attached.

Use a sub-issue when the child is part of finishing the parent; use `Blocked by:` when the two are separate pieces of work that merely have an order.

## Step 6 — Report

Give the user the issue number and URL that `gh` returns, plus a one-line summary of what was filed. Don't assign, don't add it to a project board and don't start implementing it unless asked.

If the work is picked up later, the commits that close it reference the number as a subject suffix, as the `commit` skill describes: `feat(backend): add optimistic locking to Item and Collection (#42)`.
