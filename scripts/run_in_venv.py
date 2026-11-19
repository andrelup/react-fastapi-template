"""Run a Python tool from the project's ``.venv``; the backend pre-commit hooks go through it.

pre-commit runs hooks from the repository root and does not put ``.venv`` on
``PATH``, so a hook that calls ``ruff`` or ``mypy`` by name runs whatever copy
happens to be installed globally. This launcher calls the virtualenv's own
interpreter by its path instead, so the hooks use exactly what
``pip install -e ".[dev]"`` installed from ``backend/pyproject.toml``, the same
versions CI installs. See ``docs/adr/0007-versiones-de-ruff-y-mypy-en-pre-commit.md``.

Usage::

    python scripts/run_in_venv.py [--cwd DIR] MODULE [ARGS...]

``MODULE`` runs as ``python -m MODULE ARGS...``. ``--cwd`` is relative to the
repository root. Without it the tool runs from the root, which is where the
file names that pre-commit appends are relative to.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
USAGE = "usage: python scripts/run_in_venv.py [--cwd DIR] MODULE [ARGS...]"


def venv_python(root: Path, *, windows: bool = os.name == "nt") -> Path:
    """Return the interpreter inside ``root/.venv``, whose layout differs on Windows."""
    return root / ".venv" / ("Scripts/python.exe" if windows else "bin/python")


def main(argv: list[str] | None = None, root: Path = ROOT) -> int:
    """Run ``python -m MODULE ARGS...`` with the venv interpreter and return its exit code."""
    args = list(sys.argv[1:] if argv is None else argv)
    cwd = root
    if args[:1] == ["--cwd"]:
        if len(args) < 2:
            print(USAGE, file=sys.stderr)
            return 2
        cwd = root / args[1]
        args = args[2:]
    if not args:
        print(USAGE, file=sys.stderr)
        return 2

    python = venv_python(root)
    if not python.is_file():
        print(
            f"No virtualenv interpreter at {python}.\n"
            "The backend hooks run ruff and mypy from the project's .venv: "
            "create it with `make setup`.",
            file=sys.stderr,
        )
        return 1

    # S603: the arguments come from the versioned `.pre-commit-config.yaml`, and no shell is used.
    command = [str(python), "-m", *args]
    return subprocess.run(command, cwd=cwd, check=False).returncode  # noqa: S603


if __name__ == "__main__":
    sys.exit(main())
