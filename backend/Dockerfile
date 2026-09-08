# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

FROM python:3.12-slim AS runtime

WORKDIR /app

# Sin bufer en stdout/stderr. La salida propia de la aplicacion ya pasa por
# logging.StreamHandler, que hace flush en cada registro, pero esto cubre lo
# que no pasa por logging -- un print de una libreria de terceros, o el
# traceback que el interprete escribe al morir -- para que una muerte brusca
# del proceso no se lleve por delante las ultimas lineas.
ENV PYTHONUNBUFFERED=1

RUN useradd --create-home --shell /bin/bash appuser

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
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
