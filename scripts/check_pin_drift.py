"""Fail when `.pre-commit-config.yaml` drifts from `backend/pyproject.toml`.

Why this exists (ADR 0007): the pre-commit hooks for ruff and mypy are remote
repos, so their versions cannot be read from `pyproject.toml` and are copied
by hand. CI installs the versions from `pyproject.toml`; if the copies
disagree, the commit hook and the CI `lint` job can give different verdicts
on the same tree. This script compares:

  * the `rev` of the ruff-pre-commit hook against `ruff==` in the `dev` extra
  * the `rev` of the mirrors-mypy hook against `mypy==` in the `dev` extra
  * every `additional_dependencies` entry of the mypy hook against the pin
    of the same package (and extras) in `dependencies` / the `dev` extra

An entry that is not pinned with `==`, or that does not exist in
`pyproject.toml`, is also reported. Every problem is printed; exit code 1.

Usage (from anywhere):

    python scripts/check_pin_drift.py [CONFIG_YAML] [PYPROJECT_TOML]

Needs Python >= 3.11 (`tomllib`) and PyYAML. It runs as a pre-commit local
hook (own isolated env, PyYAML declared there) and in the CI `lint` job
(PyYAML comes with the pinned `pre-commit` dev dependency).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

import tomllib
import yaml

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / ".pre-commit-config.yaml"
DEFAULT_PYPROJECT = ROOT / "backend" / "pyproject.toml"

RUFF_REPO = "ruff-pre-commit"
MYPY_REPO = "mirrors-mypy"

# `name[extra1,extra2]==1.2.3`, `name[extra]`, `name>=2`, `name`
_SPEC = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*(?:\[([^\]]*)\])?\s*(.*?)\s*$")


class Spec:
    """A parsed requirement: normalised name, extras and the pinned version."""

    def __init__(self, raw: str) -> None:
        match = _SPEC.match(raw)
        if match is None:
            raise ValueError(f"cannot parse requirement {raw!r}")
        name, extras, rest = match.groups()
        self.raw = raw
        self.name = re.sub(r"[-_.]+", "-", name).lower()
        self.extras = frozenset(e.strip().lower() for e in (extras or "").split(",") if e.strip())
        pin = re.fullmatch(r"==\s*([^\s,;=<>!~]+)", rest)
        self.version: str | None = pin.group(1) if pin else None


def _load_pyproject_pins(pyproject: Path) -> dict[str, Spec]:
    data: dict[str, Any] = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    project = data["project"]
    dev = project.get("optional-dependencies", {}).get("dev", [])
    return {spec.name: spec for spec in map(Spec, [*project.get("dependencies", []), *dev])}


def _find_hooks(config: dict[str, Any], repo_fragment: str) -> list[dict[str, Any]]:
    return [r for r in config.get("repos", []) if repo_fragment in str(r.get("repo", ""))]


def _check_rev(
    config: dict[str, Any], repo_fragment: str, tool: str, pins: dict[str, Spec]
) -> list[str]:
    repos = _find_hooks(config, repo_fragment)
    expected = pins.get(tool)
    if not repos:
        return [f"{tool}: no '{repo_fragment}' repo found in .pre-commit-config.yaml"]
    if expected is None or expected.version is None:
        return [f"{tool}: pyproject.toml does not pin '{tool}' with == (found nothing exact)"]
    rev = str(repos[0].get("rev", ""))
    if rev.removeprefix("v") != expected.version:
        return [
            f"{tool}: .pre-commit-config.yaml rev is {rev!r} but pyproject.toml pins "
            f"{tool}=={expected.version} (expected rev 'v{expected.version}')"
        ]
    return []


def _check_mypy_deps(config: dict[str, Any], pins: dict[str, Spec]) -> list[str]:
    problems: list[str] = []
    for repo in _find_hooks(config, MYPY_REPO):
        for hook in repo.get("hooks", []):
            if hook.get("id") != "mypy":
                continue
            for raw in hook.get("additional_dependencies", []):
                dep = Spec(str(raw))
                if dep.version is None:
                    problems.append(f"mypy hook: {raw!r} is not pinned with ==")
                    continue
                source = pins.get(dep.name)
                if source is None:
                    problems.append(
                        f"mypy hook: {raw!r} does not exist in pyproject.toml "
                        "(dependencies or the dev extra)"
                    )
                elif source.version is None:
                    problems.append(
                        f"mypy hook: {raw!r}: pyproject.toml has {source.raw!r}, not pinned with =="
                    )
                elif source.version != dep.version:
                    problems.append(
                        f"mypy hook: {dep.name} is {dep.version} in .pre-commit-config.yaml "
                        f"but {source.version} in pyproject.toml"
                    )
                elif source.extras != dep.extras:
                    problems.append(
                        f"mypy hook: {dep.name} extras are {sorted(dep.extras)} in "
                        f".pre-commit-config.yaml but {sorted(source.extras)} in pyproject.toml"
                    )
    return problems


def find_drift(config_path: Path, pyproject_path: Path) -> list[str]:
    """Return one message per mismatch; an empty list means both files agree."""
    config: dict[str, Any] = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    pins = _load_pyproject_pins(pyproject_path)
    return [
        *_check_rev(config, RUFF_REPO, "ruff", pins),
        *_check_rev(config, MYPY_REPO, "mypy", pins),
        *_check_mypy_deps(config, pins),
    ]


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    config_path = Path(args[0]) if len(args) > 0 else DEFAULT_CONFIG
    pyproject_path = Path(args[1]) if len(args) > 1 else DEFAULT_PYPROJECT
    problems = find_drift(config_path, pyproject_path)
    if not problems:
        print("pre-commit pins match backend/pyproject.toml")
        return 0
    print("pre-commit pins drifted from backend/pyproject.toml:", file=sys.stderr)
    for problem in problems:
        print(f"  - {problem}", file=sys.stderr)
    print(
        "Update .pre-commit-config.yaml (or pyproject.toml) so both agree. See docs/adr/0007.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
