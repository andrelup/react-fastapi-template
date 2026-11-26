# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src

# The pip upgrade only matters for this stage. Dependencies are installed into a
# separate prefix (/install) so that only what the application needs reaches the
# final image: copying the whole `site-packages` also shipped the upgraded pip,
# whose vendored SBOM declares setuptools 70.3.0 (CVE-2025-47273) and left two
# `pip-*.dist-info` mixed with the base image's pip.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --prefix=/install .

FROM python:3.12-slim AS runtime

WORKDIR /app

# Sin bufer en stdout/stderr. La salida propia de la aplicacion ya pasa por
# logging.StreamHandler, que hace flush en cada registro, pero esto cubre lo
# que no pasa por logging -- un print de una libreria de terceros, o el
# traceback que el interprete escribe al morir -- para que una muerte brusca
# del proceso no se lleve por delante las ultimas lineas.
ENV PYTHONUNBUFFERED=1

# The base image lags days behind Debian's security fixes: python:3.12-slim
# shipped zlib1g (CVE-2026-85091) and then libzstd1 (CVE-2026-124851) vulnerable
# while trixie-security already had the fix, and Trivy fails the build on both.
# OS packages are indirect dependencies: they are not tracked one by one, they
# only have to pass the vulnerability scan. So the whole system is upgraded and
# a lagging base image needs no change here. The cost: two builds on different
# days may carry different package versions, as the floating 3.12-slim tag
# already does. See docs/adr/0010-dependencias-directas-y-paquetes-del-sistema.md.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

COPY --from=builder /install /usr/local
COPY src ./src
# Alembic viaja en la imagen: el contenedor aplica `alembic upgrade head` al
# arrancar y ya no hay volumen del host del que leerlo.
COPY alembic.ini ./
COPY alembic ./alembic

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3)" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
