"""Unit tests for Settings: required values, parsing and database_url composition."""

from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError
from src.config.settings import Settings

# Every value Settings refuses to default: the addresses and the secrets.
# Distinctive strings, so a test can tell whether an error message echoes them.
_REQUIRED: dict[str, Any] = {
    "db_host": "db.required.test",
    "db_port": 6543,
    "db_password": "required-db-password",
    "jwt_secret_key": "required-jwt-secret",
    "cors_allowed_origins": "http://app.required.test",
}


def make_settings(**overrides: Any) -> Settings:
    """Build Settings isolated from the developer's real .env file."""
    values = {**_REQUIRED, **overrides}
    # mypy doesn't know pydantic-settings' _env_file init kwarg.
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def settings_without(field: str) -> Settings:
    """Build Settings with every required value except `field`."""
    values = {name: value for name, value in _REQUIRED.items() if name != field}
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def test_database_url_composed_from_discrete_fields() -> None:
    # Arrange
    settings = make_settings(
        db_host="db.example.com",
        db_port=5433,
        db_username="alice",
        db_password="secret",
        db_name="catalogue_test",
    )

    # Act
    url = settings.database_url

    # Assert
    assert url == "postgresql+asyncpg://alice:secret@db.example.com:5433/catalogue_test"


def test_database_url_when_password_has_special_chars_is_url_encoded() -> None:
    # Arrange
    settings = make_settings(
        db_username="alice",
        db_password="p@ss:w/rd+1",
        db_name="catalogue_test",
    )

    # Act
    url = settings.database_url

    # Assert
    assert "p%40ss%3Aw%2Frd%2B1" in url
    assert "p@ss:w/rd+1" not in url


@pytest.mark.parametrize("field", sorted(_REQUIRED))
def test_settings_when_required_value_missing_raises_validation_error(
    field: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Arrange — addresses and secrets must come from the environment, so
    # instantiating without one of them anywhere must fail loudly instead of
    # falling back to localhost. The process env is a source too: clear it.
    monkeypatch.delenv(field.upper(), raising=False)

    # Act
    with pytest.raises(ValidationError) as exc_info:
        settings_without(field)

    # Assert — the error names the missing value
    errors = exc_info.value.errors()
    assert [error["loc"] for error in errors] == [(field,)]
    assert errors[0]["type"] == "missing"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("db_host", ""),
        ("db_host", "   "),
        ("cors_allowed_origins", ""),
        ("cors_allowed_origins", " , "),
    ],
)
def test_settings_when_address_is_empty_raises_validation_error(field: str, value: str) -> None:
    # Arrange — `KEY=` in a .env is as missing as no key at all: compose's `:?`
    # and the frontend's check both reject it, so the backend must too.

    # Act
    with pytest.raises(ValidationError) as exc_info:
        make_settings(**{field: value})

    # Assert
    assert [error["loc"] for error in exc_info.value.errors()] == [(field,)]


def test_settings_error_when_value_missing_does_not_echo_other_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Arrange — pydantic prints the whole input next to a missing field
    # unless told not to, and that input holds the secrets read from .env.
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)

    # Act
    with pytest.raises(ValidationError) as exc_info:
        settings_without("cors_allowed_origins")

    # Assert
    message = str(exc_info.value)
    assert "cors_allowed_origins" in message
    for field, value in _REQUIRED.items():
        if field != "cors_allowed_origins":
            assert str(value) not in message


def test_settings_jwt_defaults() -> None:
    # Arrange / Act
    settings = make_settings()

    # Assert
    assert settings.jwt_algorithm == "HS256"
    assert settings.jwt_access_token_expires_minutes == 60


def test_cors_allowed_origins_parses_comma_separated_string() -> None:
    # Arrange / Act — extra whitespace and a trailing empty entry must be
    # stripped and ignored, mirroring what a human would type in .env.
    settings = make_settings(cors_allowed_origins="http://a.com, http://b.com")

    # Assert
    assert settings.cors_allowed_origins == ["http://a.com", "http://b.com"]


def test_cors_allowed_origins_ignores_blank_entries() -> None:
    # Arrange / Act
    settings = make_settings(cors_allowed_origins="http://a.com, ,")

    # Assert
    assert settings.cors_allowed_origins == ["http://a.com"]


def test_cors_allowed_origins_parsed_from_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    # Arrange — the real EnvSettingsSource path (a CORS_ALLOWED_ORIGINS env var),
    # which crashed the container: a complex list[str] field is JSON-decoded by
    # the env source before the validator runs. NoDecode must keep it working.
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000, https://foo.com")

    # Act — _env_file=None only disables the .env file, not the process env source
    settings = settings_without("cors_allowed_origins")

    # Assert
    assert settings.cors_allowed_origins == ["http://localhost:3000", "https://foo.com"]


def test_env_file_is_resolved_to_the_monorepo_root_absolutely() -> None:
    # Arrange — the configured env_file must be an absolute path to the single
    # root .env so settings load no matter the CWD (make seed/migrate and
    # pytest run from backend/, uvicorn/python may run from the repo root).
    env_file = Path(Settings.model_config["env_file"])  # type: ignore[arg-type]

    # Act / Assert
    assert env_file.is_absolute()
    assert env_file.name == ".env"
    # Its parent is the monorepo root: it holds the Makefile and the backend/ dir.
    assert (env_file.parent / "Makefile").is_file()
    assert (env_file.parent / "backend").is_dir()
