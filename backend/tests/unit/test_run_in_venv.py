"""Unit tests for ``scripts/run_in_venv.py``, the launcher behind the backend pre-commit hooks.

The script lives at the monorepo root, outside ``backend/``, so it is loaded by path inside a
fixture. A copy of the backend without the root ``scripts/`` folder skips these tests instead of
failing collection for the whole suite.
"""

import importlib.util
import subprocess
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "run_in_venv.py"


@pytest.fixture(scope="module")
def launcher() -> ModuleType:
    if not SCRIPT.is_file():
        pytest.skip(f"{SCRIPT} not found: backend/ was copied without the monorepo root")
    spec = importlib.util.spec_from_file_location("run_in_venv", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fake_venv(root: Path, launcher: ModuleType) -> Path:
    python: Path = launcher.venv_python(root)
    python.parent.mkdir(parents=True)
    python.touch()
    return python


def test_venv_python_uses_scripts_on_windows_and_bin_elsewhere(
    launcher: ModuleType, tmp_path: Path
) -> None:
    # Act
    windows = launcher.venv_python(tmp_path, windows=True)
    posix = launcher.venv_python(tmp_path, windows=False)

    # Assert
    assert windows == tmp_path / ".venv" / "Scripts" / "python.exe"
    assert posix == tmp_path / ".venv" / "bin" / "python"


def test_runs_the_module_with_the_venv_interpreter_from_the_root(
    launcher: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Arrange
    python = _fake_venv(tmp_path, launcher)
    calls: list[dict[str, Any]] = []

    def fake_run(cmd: list[str], **kwargs: Any) -> subprocess.CompletedProcess[bytes]:
        calls.append({"cmd": cmd, **kwargs})
        return subprocess.CompletedProcess(cmd, 5)

    monkeypatch.setattr(launcher.subprocess, "run", fake_run)

    # Act
    code = launcher.main(["ruff", "check", "--fix", "backend/src/app.py"], root=tmp_path)

    # Assert
    assert code == 5
    assert calls == [
        {
            "cmd": [str(python), "-m", "ruff", "check", "--fix", "backend/src/app.py"],
            "cwd": tmp_path,
            "check": False,
        }
    ]


def test_cwd_option_runs_the_tool_from_that_directory(
    launcher: ModuleType, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Arrange: a real interpreter, and a probe module that records where it ran
    monkeypatch.setattr(launcher, "venv_python", lambda root: Path(sys.executable))
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / "probe_tool.py").write_text(
        "import pathlib, sys\n"
        "pathlib.Path('seen.txt').write_text(' '.join(sys.argv[1:]))\n"
        "sys.exit(3)\n"
    )

    # Act
    code = launcher.main(["--cwd", "backend", "probe_tool", "--strict", "."], root=tmp_path)

    # Assert
    assert code == 3
    assert (backend / "seen.txt").read_text() == "--strict ."


def test_missing_venv_fails_and_points_to_make_setup(
    launcher: ModuleType, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # Act
    code = launcher.main(["mypy", "--strict", "."], root=tmp_path)

    # Assert
    assert code == 1
    assert "make setup" in capsys.readouterr().err


@pytest.mark.parametrize("argv", [[], ["--cwd"], ["--cwd", "backend"]])
def test_missing_module_prints_usage(
    launcher: ModuleType,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    argv: list[str],
) -> None:
    # Arrange
    _fake_venv(tmp_path, launcher)

    # Act
    code = launcher.main(argv, root=tmp_path)

    # Assert
    assert code == 2
    assert "usage:" in capsys.readouterr().err
