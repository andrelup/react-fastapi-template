"""Tests for `scripts/check_pin_drift.py` (ADR 0007).

They live under `backend/tests/` on purpose: the CI `test-backend` job runs
`pytest` from `backend/`, so this is the place CI already executes. The script
sits in the root `scripts/` folder, so it is loaded by path.
"""

import importlib.util
import shutil
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "scripts" / "check_pin_drift.py"


def _load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("check_pin_drift", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


drift = _load_script()

PYPROJECT = """\
[project]
name = "x"
dependencies = ["fastapi==1.0.0", "sqlalchemy[asyncio]==2.0.0", "loose>=1"]

[project.optional-dependencies]
dev = ["ruff==0.9.9", "mypy==1.2.3", "types-foo==3.0.0.1"]
"""


def _config(
    ruff_rev: str = "v0.9.9",
    mypy_rev: str = "v1.2.3",
    deps: tuple[str, ...] = ("fastapi==1.0.0", "sqlalchemy[asyncio]==2.0.0", "types-foo==3.0.0.1"),
) -> str:
    dep_lines = "\n".join(f"          - {d!r}" for d in deps)
    return f"""\
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: {ruff_rev}
    hooks:
      - id: ruff-check
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: {mypy_rev}
    hooks:
      - id: mypy
        additional_dependencies:
{dep_lines}
"""


def _run(tmp_path: Path, config: str, pyproject: str = PYPROJECT) -> list[str]:
    config_file = tmp_path / ".pre-commit-config.yaml"
    pyproject_file = tmp_path / "pyproject.toml"
    config_file.write_text(config, encoding="utf-8")
    pyproject_file.write_text(pyproject, encoding="utf-8")
    result: list[str] = drift.find_drift(config_file, pyproject_file)
    return result


def test_real_tree_is_in_sync() -> None:
    problems = drift.find_drift(
        REPO_ROOT / ".pre-commit-config.yaml", REPO_ROOT / "backend" / "pyproject.toml"
    )
    assert problems == []


def test_synthetic_aligned_copy_passes(tmp_path: Path) -> None:
    assert _run(tmp_path, _config()) == []


def test_ruff_rev_mismatch_is_reported(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(ruff_rev="v0.9.0"))
    assert len(problems) == 1
    assert "ruff" in problems[0]
    assert "'v0.9.0'" in problems[0]
    assert "ruff==0.9.9" in problems[0]


def test_mypy_rev_mismatch_is_reported(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(mypy_rev="v1.0.0"))
    assert len(problems) == 1
    assert "mypy" in problems[0]
    assert "mypy==1.2.3" in problems[0]


def test_dependency_version_mismatch_names_the_package(tmp_path: Path) -> None:
    deps = ("fastapi==9.9.9", "sqlalchemy[asyncio]==2.0.0", "types-foo==3.0.0.1")
    problems = _run(tmp_path, _config(deps=deps))
    assert len(problems) == 1
    assert "fastapi is 9.9.9" in problems[0]
    assert "1.0.0 in pyproject.toml" in problems[0]


def test_unpinned_dependency_is_reported(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(deps=("fastapi>=1",)))
    assert problems == ["mypy hook: 'fastapi>=1' is not pinned with =="]


def test_dependency_missing_from_pyproject_is_reported(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(deps=("ghost==1.0",)))
    assert len(problems) == 1
    assert "'ghost==1.0' does not exist in pyproject.toml" in problems[0]


def test_dependency_not_pinned_in_pyproject_is_reported(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(deps=("loose==1.0",)))
    assert len(problems) == 1
    assert "not pinned with ==" in problems[0]
    assert "loose>=1" in problems[0]


def test_extras_mismatch_is_reported(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(deps=("sqlalchemy==2.0.0",)))
    assert len(problems) == 1
    assert "extras" in problems[0]


def test_every_mismatch_is_reported_at_once(tmp_path: Path) -> None:
    problems = _run(tmp_path, _config(ruff_rev="v0.1.0", deps=("fastapi==9.9.9", "ghost==1")))
    assert len(problems) == 3


def test_main_exits_non_zero_and_prints_the_mismatch(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    config_file = tmp_path / "cfg.yaml"
    pyproject_file = tmp_path / "pyproject.toml"
    config_file.write_text(_config(ruff_rev="v0.1.0"), encoding="utf-8")
    pyproject_file.write_text(PYPROJECT, encoding="utf-8")

    assert drift.main([str(config_file), str(pyproject_file)]) == 1
    assert "ruff: .pre-commit-config.yaml rev is 'v0.1.0'" in capsys.readouterr().err


def test_main_exits_zero_on_the_real_tree(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    config_copy = tmp_path / ".pre-commit-config.yaml"
    pyproject_copy = tmp_path / "pyproject.toml"
    shutil.copy(REPO_ROOT / ".pre-commit-config.yaml", config_copy)
    shutil.copy(REPO_ROOT / "backend" / "pyproject.toml", pyproject_copy)

    assert drift.main([str(config_copy), str(pyproject_copy)]) == 0
    assert "match" in capsys.readouterr().out
