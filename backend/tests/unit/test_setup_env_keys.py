"""Unit tests for the .env key check in ``scripts/setup.py`` (``make setup``).

The script lives at the monorepo root, outside ``backend/``, so it is loaded by path inside a
fixture. A copy of the backend without the root ``scripts/`` folder skips these tests instead of
failing collection for the whole suite.
"""

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "setup.py"


@pytest.fixture(scope="module")
def setup_script() -> ModuleType:
    if not SCRIPT.is_file():
        pytest.skip(f"{SCRIPT} not found: backend/ was copied without the monorepo root")
    spec = importlib.util.spec_from_file_location("setup_script", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write(path: Path, content: str) -> Path:
    path.write_text(content, encoding="utf-8")
    return path


def test_env_keys_skips_comments_blank_lines_and_lines_without_a_value(
    setup_script: ModuleType, tmp_path: Path
) -> None:
    # Arrange
    env_file = _write(
        tmp_path / ".env",
        "# a comment\n\nDB_HOST=localhost\n  DB_PORT = 5432\nnot a variable\nEMPTY=\n",
    )

    # Act
    keys = setup_script.env_keys(env_file)

    # Assert
    assert keys == {"DB_HOST", "DB_PORT", "EMPTY"}


def test_env_keys_accepts_the_export_prefix(setup_script: ModuleType, tmp_path: Path) -> None:
    # Arrange
    env_file = _write(tmp_path / ".env", "export VITE_API_URL=http://localhost:8000\n")

    # Act
    keys = setup_script.env_keys(env_file)

    # Assert
    assert keys == {"VITE_API_URL"}


def test_missing_env_keys_lists_the_example_keys_an_old_env_lacks(
    setup_script: ModuleType, tmp_path: Path
) -> None:
    # Arrange — an .env created before the example grew two required keys
    example = _write(
        tmp_path / ".env.example",
        "DB_HOST=localhost\nVITE_API_URL=http://localhost:8000\nCORS_ALLOWED_ORIGINS=x\n",
    )
    env_file = _write(tmp_path / ".env", "DB_HOST=db\nLOCAL_ONLY=1\n")

    # Act
    missing = setup_script.missing_env_keys(env_file, example)

    # Assert — sorted, and keys only the .env has are not reported
    assert missing == ["CORS_ALLOWED_ORIGINS", "VITE_API_URL"]


def test_missing_env_keys_is_empty_for_a_complete_env(
    setup_script: ModuleType, tmp_path: Path
) -> None:
    # Arrange
    example = _write(tmp_path / ".env.example", "DB_HOST=localhost\nDB_PORT=5432\n")
    env_file = _write(tmp_path / ".env", "DB_PORT=5434\nDB_HOST=localhost\n")

    # Act / Assert
    assert setup_script.missing_env_keys(env_file, example) == []


def test_the_repo_env_example_declares_every_required_address(setup_script: ModuleType) -> None:
    # Arrange — the keys Settings, Vite and compose refuse to default
    example = SCRIPT.parents[1] / ".env.example"

    # Act
    keys = setup_script.env_keys(example)

    # Assert
    assert {"DB_HOST", "DB_PORT", "CORS_ALLOWED_ORIGINS", "VITE_API_URL"} <= keys
