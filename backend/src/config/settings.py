"""Application settings, loaded from environment variables.

Importing this module must never trigger a database connection or
any other side effect.
"""

from pathlib import Path
from typing import Annotated
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# The single monorepo-root .env is the source of truth for configuration.
# Resolve it by absolute path so the settings load regardless of the current
# working directory: `make dev` (docker compose), `make migrate`/`make seed`
# and `pytest` all run from `backend/`, while a plain `uvicorn`/`python` may
# run from the repo root. settings.py lives at backend/src/config/, so the
# repo root is three parents up.
_ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    """Environment-driven application settings."""

    model_config = SettingsConfigDict(
        env_file=_ROOT_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BookShelf API"
    environment: str = "development"
    db_host: str = "localhost"
    db_port: int = 5432
    db_username: str = "bookshelf"
    # Required on purpose: secrets must come from the environment, never code.
    db_password: str
    db_name: str = "bookshelf"
    log_level: str = "INFO"
    # Origins allowed to call the API from a browser (CORS). Comma-separated
    # in the .env file, e.g. "http://localhost:3000,http://localhost:5173".
    # NoDecode disables pydantic-settings' JSON decoding for this env var so
    # the plain comma-separated string reaches _split_cors_origins below;
    # without it a non-JSON value raises SettingsError at startup.
    cors_allowed_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # Required on purpose: the JWT signing secret must come from the
    # environment, never hardcoded.
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expires_minutes: int = 60

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        """Parse a comma-separated CORS_ALLOWED_ORIGINS string from the environment."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def database_url(self) -> str:
        """Async SQLAlchemy URL built from the discrete DB_* variables."""
        return (
            f"postgresql+asyncpg://{self.db_username}:{quote_plus(self.db_password)}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


# mypy can't know that the required db_password/jwt_secret_key arrive via .env at runtime.
settings = Settings()  # type: ignore[call-arg]
