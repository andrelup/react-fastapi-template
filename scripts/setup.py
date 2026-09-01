"""Local development bootstrap for the react-fastapi-template monorepo.

Canonical entrypoint (from the repo root):

    make setup

Leaves the machine ready to work on backend and frontend *outside* Docker
(hot reload on both sides), which is what day-to-day development needs:

  1. .env created from .env.example (if missing)
  2. .venv at the repo root (Python >= 3.12)
  3. backend installed editable with its dev extras
  4. frontend npm dependencies installed
  5. pre-commit git hooks installed
  6. PostgreSQL container up + Alembic migrations + seed data

Every step is idempotent: running it again on an already-configured machine
only re-checks and re-installs what changed.

This is a plain-stdlib script on purpose: it runs with the *system* Python
before any virtualenv exists, and it must behave the same on Windows
(where GNU Make spawns cmd.exe) and on Linux/macOS.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import NoReturn

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
INFRA = ROOT / "infra"
VENV = ROOT / ".venv"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"

MIN_PYTHON = (3, 12)
IS_WINDOWS = platform.system() == "Windows"
# Fixed in infra/docker-compose.yml; used to poll the healthcheck.
POSTGRES_CONTAINER = "react-fastapi-template-postgres"
DB_WAIT_TIMEOUT_SECONDS = 90

# Collected instead of raised: a missing Docker must not undo the toolchain
# steps that already succeeded, so the script finishes and reports at the end.
warnings: list[str] = []


# --------------------------------------------------------------------------
# Output helpers
# --------------------------------------------------------------------------


def step(number: int, total: int, title: str) -> None:
    print(f"\n[{number}/{total}] {title}", flush=True)


def info(message: str) -> None:
    print(f"      {message}", flush=True)


def warn(message: str) -> None:
    print(f"      AVISO: {message}", flush=True)
    warnings.append(message)


def fail(message: str) -> NoReturn:
    print(f"\nERROR: {message}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def run(command: list[str], cwd: Path = ROOT) -> None:
    """Run a command, streaming its output, and abort the setup if it fails."""
    info(f"$ {' '.join(command)}")
    result = subprocess.run(command, cwd=cwd, check=False)
    if result.returncode != 0:
        fail(f"el comando fallo (codigo {result.returncode}): {' '.join(command)}")


def capture(command: list[str], cwd: Path = ROOT) -> tuple[int, str]:
    """Run a command quietly and return (returncode, stdout + stderr)."""
    try:
        result = subprocess.run(
            command, cwd=cwd, capture_output=True, text=True, check=False
        )
    except OSError as exc:  # executable missing or not runnable
        return 127, str(exc)
    return result.returncode, (result.stdout or "") + (result.stderr or "")


def tool(name: str) -> str | None:
    """Absolute path of an executable on PATH, or None (npm is a .cmd on Windows)."""
    return shutil.which(name)


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


# --------------------------------------------------------------------------
# Steps
# --------------------------------------------------------------------------


def check_prerequisites(skip_front: bool) -> None:
    if sys.version_info < MIN_PYTHON:
        fail(
            f"se requiere Python >= {MIN_PYTHON[0]}.{MIN_PYTHON[1]}, pero este "
            f"interprete es {platform.python_version()}. Instala una version mas "
            "nueva y vuelve a lanzar `make setup`."
        )
    info(f"Python {platform.python_version()} OK ({sys.executable})")

    if skip_front:
        return
    npm = tool("npm")
    if npm is None:
        fail(
            "no se encuentra `npm` en el PATH. Instala Node.js 20+ "
            '(https://nodejs.org) o lanza `make setup ARGS="--skip-front"`.'
        )
    code, out = capture([npm, "--version"])
    info(f"npm {out.strip() if code == 0 else '(version desconocida)'} OK")


def ensure_env_file() -> None:
    if ENV_FILE.exists():
        info(".env ya existe, no se toca")
        return
    if not ENV_EXAMPLE.exists():
        fail(f"no existe {ENV_EXAMPLE}, no se puede generar el .env")
    shutil.copyfile(ENV_EXAMPLE, ENV_FILE)
    info(".env creado a partir de .env.example")
    warn(
        "el .env recien creado lleva valores de ejemplo: cambia DB_PASSWORD y "
        "JWT_SECRET_KEY antes de usarlo en cualquier entorno que no sea local."
    )


def ensure_venv() -> None:
    if venv_python().exists():
        info(f"entorno virtual ya presente en {VENV}")
        return
    info(f"creando entorno virtual en {VENV}")
    run([sys.executable, "-m", "venv", str(VENV)])
    if not venv_python().exists():
        fail(f"el entorno virtual no se creo correctamente en {VENV}")


def install_backend() -> None:
    python = str(venv_python())
    run([python, "-m", "pip", "install", "--upgrade", "pip"])
    # Editable install: changes under backend/src are picked up without
    # reinstalling, and `.[dev]` brings pytest, ruff, mypy and pre-commit.
    run([python, "-m", "pip", "install", "-e", ".[dev]"], cwd=BACKEND)


def install_frontend() -> None:
    npm = tool("npm")
    if npm is None:  # already validated in check_prerequisites
        fail("no se encuentra `npm` en el PATH")
    # `npm ci` is the reproducible install, but it requires the lockfile to be
    # in sync with package.json; fall back to `npm install` when it is not.
    if (FRONTEND / "package-lock.json").exists():
        code, out = capture([npm, "ci"], cwd=FRONTEND)
        if code == 0:
            info("dependencias npm instaladas con `npm ci`")
            return
        info(out.strip()[-500:])
        warn("`npm ci` fallo, se reintenta con `npm install`")
    run([npm, "install"], cwd=FRONTEND)


def install_hooks() -> None:
    run([str(venv_python()), "-m", "pre_commit", "install"])


def compose(*args: str) -> list[str]:
    return ["docker", "compose", "--env-file", str(ENV_FILE), *args]


def start_database() -> bool:
    """Bring up the PostgreSQL container and wait until its healthcheck passes."""
    if tool("docker") is None:
        warn(
            "no se encuentra `docker` en el PATH; me salto base de datos, migraciones y seed"
        )
        return False
    code, _ = capture(["docker", "info"])
    if code != 0:
        warn("Docker no esta arrancado; me salto base de datos, migraciones y seed")
        return False

    run(compose("up", "-d", "postgres"), cwd=INFRA)

    info("esperando a que PostgreSQL este healthy...")
    deadline = time.monotonic() + DB_WAIT_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        code, out = capture(
            ["docker", "inspect", "-f", "{{.State.Health.Status}}", POSTGRES_CONTAINER]
        )
        status = out.strip()
        if code == 0 and status == "healthy":
            info("PostgreSQL healthy")
            return True
        if code == 0 and status == "unhealthy":
            warn(
                f"el contenedor {POSTGRES_CONTAINER} esta unhealthy; revisa `make db-logs`"
            )
            return False
        time.sleep(2)

    warn(
        f"PostgreSQL no llego a healthy en {DB_WAIT_TIMEOUT_SECONDS}s; me salto "
        "migraciones y seed (reintentalo con `make migrate` y `make seed`)"
    )
    return False


def migrate_and_seed(seed: bool) -> None:
    python = str(venv_python())
    run([python, "-m", "alembic", "upgrade", "head"], cwd=BACKEND)
    if seed:
        run([python, "seed.py"], cwd=BACKEND)


def print_summary() -> None:
    activate = (
        ".venv\\Scripts\\Activate.ps1" if IS_WINDOWS else "source .venv/bin/activate"
    )
    print("\n" + "=" * 70)
    print("Entorno local listo.")
    print("=" * 70)
    if warnings:
        print("\nAvisos:")
        for message in warnings:
            print(f"  - {message}")
    print(
        "\nPara desarrollar con hot reload en ambos lados, en dos terminales:\n"
        "  make dev-back     -> API en http://localhost:8000/docs\n"
        "  make dev-front    -> SPA en http://localhost:3000\n"
        "\nOtros comandos:\n"
        "  make dev          -> todo el entorno en Docker (sin instalar nada en local)\n"
        "  make test         -> tests de backend + frontend\n"
        "  make lint         -> ruff + mypy + eslint\n"
        "\nLos targets del Makefile llaman al .venv directamente, no hace falta "
        f"activarlo.\nPara lanzar comandos a mano: {activate}"
    )


# --------------------------------------------------------------------------
# Entrypoint
# --------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="make setup",
        description="Deja el monorepo listo para desarrollar en local.",
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="no arranca PostgreSQL ni aplica migraciones/seed",
    )
    parser.add_argument(
        "--skip-front",
        action="store_true",
        help="no instala las dependencias npm del frontend",
    )
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="aplica las migraciones pero no carga datos de ejemplo",
    )
    args = parser.parse_args()

    os.chdir(ROOT)
    total = 6
    print("Configurando el entorno local de react-fastapi-template")
    print(f"Repositorio: {ROOT}")

    step(1, total, "Comprobando prerrequisitos")
    check_prerequisites(args.skip_front)

    step(2, total, "Configurando el fichero .env")
    ensure_env_file()

    step(3, total, "Preparando el entorno virtual y el backend")
    ensure_venv()
    install_backend()

    step(4, total, "Instalando las dependencias del frontend")
    if args.skip_front:
        info("--skip-front: paso omitido")
    else:
        install_frontend()

    step(5, total, "Instalando los hooks de pre-commit")
    install_hooks()

    step(6, total, "Base de datos: contenedor, migraciones y datos de ejemplo")
    if args.skip_db:
        info("--skip-db: paso omitido")
    elif start_database():
        migrate_and_seed(seed=not args.no_seed)

    print_summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
