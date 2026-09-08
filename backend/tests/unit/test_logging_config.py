"""Unit tests for the development/production renderer selection in config/logging.py."""

from typing import Any

import pytest
import structlog
from src.config import logging as logging_config
from src.config.logging import _select_renderer
from src.config.settings import Settings


def _make_settings(**overrides: Any) -> Settings:
    """Build Settings isolated from the developer's real .env file."""
    overrides.setdefault("jwt_secret_key", "test-jwt-secret")
    overrides.setdefault("db_password", "test-db-password")
    # mypy doesn't know pydantic-settings' _env_file init kwarg.
    return Settings(_env_file=None, **overrides)  # type: ignore[call-arg]


@pytest.mark.parametrize("environment", ["dev", "development", "DEV", "local"])
def test_select_renderer_when_development_alias_returns_console_renderer(
    environment: str,
) -> None:
    # Arrange
    settings = _make_settings(environment=environment)

    # Act
    renderer = _select_renderer(settings.environment)

    # Assert
    assert isinstance(renderer, structlog.dev.ConsoleRenderer)


@pytest.mark.parametrize("environment", ["production", "staging", ""])
def test_select_renderer_when_not_development_returns_json_renderer(environment: str) -> None:
    # Arrange
    settings = _make_settings(environment=environment)

    # Act
    renderer = _select_renderer(settings.environment)

    # Assert
    assert isinstance(renderer, structlog.processors.JSONRenderer)


def test_select_renderer_when_alias_has_surrounding_whitespace_returns_console_renderer() -> None:
    # Arrange - a developer's own untracked `.env` is free-form text; the
    # comparison must tolerate stray whitespace around the value.
    settings = _make_settings(environment="  Development  ")

    # Act
    renderer = _select_renderer(settings.environment)

    # Assert
    assert isinstance(renderer, structlog.dev.ConsoleRenderer)


def test_configure_logging_when_called_again_is_a_no_op() -> None:
    # Arrange - by the time this test runs, `src.main` has already imported
    # and called `configure_logging()` once, so `_configured` is already True.

    # Act / Assert - a second call must return immediately (the idempotency
    # guard) instead of re-running `structlog.configure`/`dictConfig`.
    logging_config.configure_logging()
