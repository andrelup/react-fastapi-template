# Backend Code Style — Ruff and mypy

New backend code **must pass the Ruff and mypy rules already configured** in
`backend/pyproject.toml`. Both run as pre-commit hooks and block the commit.

Companion documents: [hexagonal architecture](./backend-hexagonal-architecture.md),
[database access](./backend-database-sqlalchemy.md), [testing](./backend-testing.md).

---

## 1. Commands

**Every Python tool is invoked from the repo root**, never from `backend/`. That keeps caches and
config resolution consistent, and it is what the Makefile does:

```bash
make lint        # ruff check + mypy over backend/
make test-back   # pytest with coverage
make format-front  # (frontend only — Ruff formatting runs through the pre-commit hook)
```

Under the hood:

```bash
.venv/Scripts/python.exe -m ruff check --cache-dir .ruff_cache backend
.venv/Scripts/python.exe -m mypy --config-file backend/pyproject.toml backend
```

Note the explicit `--config-file`: there is no `pyproject.toml` at the repo root, so without it
mypy would silently run without the strict settings.

---

## 2. Ruff

Ruff is the **single** linter and formatter. Configuration, verbatim:

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
src = ["src"]

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "SIM", "S"]
ignore = ["UP046"]

[tool.ruff.lint.flake8-bugbear]
extend-immutable-calls = [
    "fastapi.Depends", "fastapi.Query", "fastapi.Path", "fastapi.Body",
    "fastapi.Header", "fastapi.Cookie", "fastapi.File", "fastapi.Form",
    "fastapi.Security",
]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "S105", "S106"]
"tests/integration/conftest.py" = ["S603", "S607"]
```

### What the selected rule families demand

| Family | Enforces |
|---|---|
| `E` pycodestyle | Whitespace, statement layout, **100-column lines** |
| `F` Pyflakes | No unused imports or variables, no undefined names |
| `I` isort | Imports sorted and grouped: stdlib → third party → first party (`src`, `tests`) |
| `N` pep8-naming | `snake_case` functions and variables, `PascalCase` classes |
| `UP` pyupgrade | Modern 3.12 syntax: `X \| None`, not `Optional[X]`; `list[str]`, not `List[str]` |
| `B` bugbear | No mutable default arguments, no bare `except`, no silent bug patterns |
| `SIM` simplify | Collapse needlessly nested conditionals and redundant constructs |
| `S` bandit | No `assert` in production code, no hardcoded credentials, no `shell=True` |

Deliberate exceptions, and why:

- **`UP046` is ignored** on purpose: the project keeps `typing.Generic` instead of PEP 695 generic
  syntax.
- **`B008` effectively waived for FastAPI**, because `Depends(...)`, `Query(...)` and friends are
  *meant* to be called in argument defaults. That is what `extend-immutable-calls` declares.
- **`S101`, `S105`, `S106` relaxed under `tests/`**: `assert` is pytest's assertion mechanism, and
  fake passwords and tokens are unavoidable literals in test code.
- **`S603`, `S607` relaxed for `tests/integration/conftest.py`**, which shells out to the Docker CLI
  with a fixed argument list.

There is no `[tool.ruff.format]` section, so the formatter runs with its defaults — double quotes,
4-space indent — bounded by `line-length = 100`.

### Consequences for the code you write

- Type annotations use modern syntax: `User | None`, `list[User]`, `dict[str, int]`.
- No unused import survives, not even a convenience re-export — put it in `__init__.py`
  deliberately or delete it.
- Never `assert` outside tests; raise a domain exception instead.
- Never hardcode a credential; it belongs in `.env` and is read through `config/settings.py`.

---

## 3. mypy

```toml
[tool.mypy]
strict = true
python_version = "3.12"
```

That is the whole configuration: **strict mode, no per-module escape hatches, no relaxations.**

In practice, for every function you write — domain service, repository, router, fixture or test:

- **A complete signature is mandatory**, including the return type. `-> None` on procedures,
  `-> None` on every test function too.
- **No implicit `Optional`.** Write `def f(x: str | None = None)`, never `x: str = None`.
- **Untyped calls are forbidden** — you cannot call an unannotated function from typed code.
- **`Any` cannot leak.** Bare generics (`dict`, `list`) are rejected; parametrise them.
- **Stale suppressions are errors.** `warn_unused_ignores` means a `# type: ignore` that no longer
  applies fails the check.
- **Unreachable code is an error**, as is a redundant cast or a comparison between incompatible
  types.

When a third-party stub genuinely lacks the information, suppress **the specific code**, never a
bare ignore:

```python
value = something  # type: ignore[arg-type]
```

Note that mypy is **not** configured with the `pydantic.mypy` plugin, so Pydantic-specific typing
mistakes (validators, `model_config`) are not caught automatically — be careful there.

---

## 4. Pre-commit gate

Four backend hooks are configured in the root `.pre-commit-config.yaml`:

| Hook | Action |
|---|---|
| `ruff-check` | `ruff check --fix` — auto-fixes what it can |
| `ruff-format` | reformats the code in place |
| `mypy` | `mypy --strict` over the whole `backend/` tree, `--config-file backend/pyproject.toml` |
| `check-pin-drift` | fails if the hook versions no longer match `backend/pyproject.toml` |

The mypy hook checks the same scope and config as the CI `lint` job (`cd backend && mypy --strict .`):
`src/`, `tests/`, `alembic/` and `seed.py`, with `pass_filenames: false`. The hook and CI give the
same verdict on the same tree.

The ruff and mypy hooks are remote repos, so their versions are **copied** from
`backend/pyproject.toml`: the `rev` of each hook, and every entry of the mypy hook's
`additional_dependencies`, pinned with `==`. `scripts/check_pin_drift.py` runs as a hook and in
the CI `lint` job and names every mismatch. To bump a tool or a dependency, change
`backend/pyproject.toml` **and** `.pre-commit-config.yaml` in the same commit (the first run after
a bump rebuilds the hook environment, which takes a minute or two). Do not run
`pre-commit autoupdate`: it would move the revs away from `pyproject.toml`. See
`docs/adr/0007-versiones-de-ruff-y-mypy-en-pre-commit.md`.

The ruff and mypy hooks build their own isolated environments (pinned, see above), so they do not
use the project virtualenv; the frontend hooks do need `npm ci`. `make setup` (or
`make install-hooks`) installs the git hook and the npm dependencies once.

---

## 5. Conventions beyond the linters

These are not machine-enforced but are followed throughout the codebase:

- `snake_case` for modules, functions and variables; `PascalCase` only for classes, protocols,
  schemas and exceptions.
- `async`/`await` in every endpoint, service and repository.
- Docstrings on domain services, ports and any non-obvious function. Written in English, like all
  code.
- Private helpers prefixed with `_`, both module-level functions (`_to_domain`) and instance
  attributes (`self._item_repository`).
- **Never `print()`.** It is explicitly forbidden by the project rules.
- Every new environment variable goes into `config/settings.py` **and** `.env.example`. Never read
  `os.environ` elsewhere, never commit a real value.

---

## 6. Checklist

- [ ] `make lint` passes (Ruff **and** mypy, over `backend/` including tests).
- [ ] `make test-back` passes.
- [ ] Full type annotations, including return types, on everything you touched.
- [ ] Modern typing syntax (`X | None`, `list[X]`); no bare generics, no `Any`.
- [ ] No `# type: ignore` without a specific error code and a reason.
- [ ] No `assert`, no `print()`, no hardcoded secret in `src/`.
- [ ] Lines within 100 columns; imports sorted (Ruff will fix both).
