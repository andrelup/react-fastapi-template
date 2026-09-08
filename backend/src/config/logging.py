"""Structured logging configuration, shared by the API and `seed.py`.

Wires `structlog` as the single logging pipeline for the whole process,
bridging the standard-library `logging` module so records emitted by
uvicorn and SQLAlchemy go through the same processors and renderer as the
application's own `structlog.get_logger(...)` calls.

Rendering depends on `settings.environment`: pretty, colored console output
for a known development alias (see `_DEVELOPMENT_ALIASES` below), single-line
JSON for everything else, per `backend/CLAUDE.md`.
"""

import logging
import logging.config

import structlog

from src.config.settings import settings

_configured = False

# The repo spells "development" three different ways across its own
# configuration surfaces: the versioned `.env.example` ships "development",
# a developer's own untracked `.env` commonly has the shorter "dev", and
# `infra/docker-compose.yml` defaults `ENVIRONMENT` to "production" when the
# variable is unset (implying "not set" reads as local/other otherwise). This
# set absorbs that drift instead of silently falling back to JSON — which
# would defeat the console-output feature it's meant to enable — while still
# defaulting anything unrecognised to JSON, never the other way round.
_DEVELOPMENT_ALIASES = frozenset({"development", "dev", "local"})


def _is_development(environment: str) -> bool:
    """Whether `environment` should render logs as human-readable console output.

    Compared case-insensitively and stripped, against `_DEVELOPMENT_ALIASES`.
    An unrecognised value returns False (JSON) on purpose: a typo or a new
    spelling must never accidentally enable console rendering outside
    development.
    """
    return environment.strip().lower() in _DEVELOPMENT_ALIASES


def _select_renderer(environment: str) -> structlog.types.Processor:
    """Pick the final-stage renderer for `environment`."""
    if _is_development(environment):
        return structlog.dev.ConsoleRenderer(colors=True)
    return structlog.processors.JSONRenderer()


def configure_logging() -> None:
    """Configure structlog and the stdlib logging bridge.

    Idempotent: safe to call more than once (e.g. from both `main.py` and
    `seed.py`, or across pytest module imports) without stacking processors
    or handlers on repeated calls.
    """
    global _configured
    if _configured:
        return

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    renderer = _select_renderer(settings.environment)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.getLevelNamesMapping().get(settings.log_level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )

    # Bridge stdlib `logging` (uvicorn, SQLAlchemy, ...) through the same
    # processors and renderer, so every log line in the process — regardless
    # of which library emitted it — has the same shape.
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "structured": {
                    "()": structlog.stdlib.ProcessorFormatter,
                    "processors": [
                        structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                        renderer,
                    ],
                    "foreign_pre_chain": shared_processors,
                },
            },
            "handlers": {
                "default": {
                    "class": "logging.StreamHandler",
                    "formatter": "structured",
                    "stream": "ext://sys.stdout",
                },
            },
            "loggers": {
                "": {"handlers": ["default"], "level": settings.log_level.upper()},
                "uvicorn": {"handlers": ["default"], "level": settings.log_level.upper()},
                "uvicorn.error": {"level": settings.log_level.upper()},
                "uvicorn.access": {
                    "handlers": ["default"],
                    "level": settings.log_level.upper(),
                    "propagate": False,
                },
                "sqlalchemy": {
                    "handlers": ["default"],
                    "level": settings.log_level.upper(),
                    "propagate": False,
                },
            },
        }
    )

    _configured = True
