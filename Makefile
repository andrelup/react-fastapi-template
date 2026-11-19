# Comandos unificados del monorepo react-fastapi-template.
# Todos se ejecutan desde la raiz del repo.
#
# Todos prueban o ejecutan la plataforma en el equipo local, y ninguno publica
# ni despliega nada. Desplegar sera trabajo de CI cuando un proyecto creado
# desde la plantilla salga a internet.
#
# Primer contacto con el repo:
#   make setup      deja el entorno local listo para trabajar (una sola vez)
#   make dev-back   API con hot reload  (terminal 1)
#   make dev-front  SPA con hot reload  (terminal 2)
#
# Los targets no necesitan que el entorno virtual este activado: llaman al
# interprete de .venv por ruta. Windows y Linux/macOS colocan los binarios
# del venv en carpetas distintas, de ahi la deteccion de abajo.

ifeq ($(OS),Windows_NT)
SYS_PYTHON ?= python
PYTHON := .venv\Scripts\python.exe
BACKEND_PYTHON := ..\.venv\Scripts\python.exe
else
SYS_PYTHON ?= python3
PYTHON := .venv/bin/python
BACKEND_PYTHON := ../.venv/bin/python
endif

# Argumentos extra para `make setup`, p. ej.:
#   make setup ARGS="--skip-db"
ARGS ?=

# Entorno para el que `make build` construye las imagenes, p. ej.:
#   make build ENV=staging
# Sin ENV lee el .env y etiqueta :latest; con ENV lee el .env.<entorno> y
# etiqueta :<entorno>. Solo lo usa `build`: el resto de comandos lee siempre
# el .env.
ENV ?=
BUILD_ENV_FILE := $(if $(ENV),.env.$(ENV),.env)
BUILD_TAG := $(if $(ENV),$(ENV),latest)

.DEFAULT_GOAL := help

.PHONY: help setup install-hooks dev dev-back dev-front \
        test test-back test-front test-e2e lint lint-front format-front \
        migrate seed build preview

## help: lista los comandos disponibles.
help:
	@echo react-fastapi-template - comandos disponibles
	@echo   make setup        deja el entorno local listo para trabajar
	@echo   make dev-back     backend con hot reload en el host, puerto 8000
	@echo   make dev-front    frontend con hot reload en el host, puerto 3000
	@echo   make dev          solo PostgreSQL en Docker, lista para dev-back/dev-front
	@echo   make preview      stack completo en local con las imagenes de produccion
	@echo   make migrate      alembic upgrade head
	@echo   make seed         datos de ejemplo en la base de datos
	@echo   make test         tests de backend + frontend
	@echo   make test-back    solo tests del backend
	@echo   make test-front   solo tests del frontend
	@echo   make test-e2e     tests end-to-end
	@echo   make lint         ruff + mypy + eslint
	@echo   make lint-front   solo eslint
	@echo   make format-front reescribe el frontend con Prettier
	@echo   make install-hooks solo los hooks de git
	@echo   make build        imagenes Docker de backend y frontend, sin arrancarlas
	@echo                     ENV=staging las construye con el .env.staging

## setup: getting started completo. Idempotente, se puede relanzar sin miedo.
## Crea el .env, el entorno virtual, instala backend + frontend + hooks de
## pre-commit, levanta PostgreSQL y aplica migraciones y datos de ejemplo.
## Al terminar solo hace falta `make dev-back` y `make dev-front`.
setup:
	$(SYS_PYTHON) scripts/setup.py $(ARGS)

## install-hooks: solo la parte de hooks de `make setup`. Instala las
## dependencias npm del frontend (los hooks usan el ESLint/Prettier de
## frontend/node_modules) y engancha pre-commit en .git/hooks/pre-commit.
## Necesita el .venv de `make setup`: pre-commit se ejecuta desde él, y los
## hooks del backend usan su ruff y su mypy.
install-hooks:
	npm --prefix frontend ci
	$(PYTHON) -m pre_commit install

## dev: prepara el entorno de desarrollo. Docker solo levanta PostgreSQL, en
## background; el backend y el frontend se ejecutan nativos en el host, que es
## donde el hot reload funciona de verdad y donde no hace falta montar el
## codigo fuente dentro de un contenedor.
##
## Para parar los contenedores (esta BD o el stack de `make preview`), desde
## infra/: docker compose --env-file ../.env --profile prod down
dev:
	cd infra && docker compose --env-file ../.env up -d postgres
	@echo PostgreSQL levantada. Ahora, en dos terminales:
	@echo   make dev-back     API en http://localhost:8000/docs
	@echo   make dev-front    SPA en http://localhost:3000

## dev-back: backend en el host con hot reload, contra la PostgreSQL de Docker.
## Requiere `make setup` (o al menos `make dev`) hecho antes.
dev-back:
	cd backend && $(BACKEND_PYTHON) -m uvicorn src.main:app --reload --port 8000

## dev-front: frontend en el host con hot reload (Vite, puerto 3000).
dev-front:
	npm --prefix frontend run dev

## test: suite completa (pytest en backend + vitest en frontend). test-e2e
## se ejecuta aparte porque necesita el entorno (API + DB + seed) levantado.
test: test-back test-front

## test-back: tests del backend (pytest) con reporte de cobertura.
test-back:
	cd backend && $(BACKEND_PYTHON) -m pytest --cov=src --cov-report=term-missing

## test-front: tests del frontend (vitest, una sola pasada).
test-front:
	npm --prefix frontend run test

## test-e2e: tests end-to-end (Playwright). Requiere la base de datos y la API
## (make dev, make dev-back) sembrada con make seed, por las cuentas fijas que
## usan los specs. El frontend NO hace falta levantarlo: Playwright arranca su
## propio npm run dev via webServer, y reutiliza el que ya este corriendo en el
## 3000 si lo hay.
test-e2e:
	npm --prefix frontend run test:e2e

## lint: ruff check + mypy en backend, eslint en frontend.
lint:
	cd backend && $(BACKEND_PYTHON) -m ruff check . && $(BACKEND_PYTHON) -m mypy .
	npm --prefix frontend run lint

## lint-front: solo el linter del frontend (eslint, falla con cualquier warning).
lint-front:
	npm --prefix frontend run lint

## format-front: reescribe el frontend con el formato de Prettier.
format-front:
	npm --prefix frontend run format

## migrate: aplica las migraciones de Alembic hasta la ultima revision.
migrate:
	cd backend && $(BACKEND_PYTHON) -m alembic upgrade head

## seed: pobla la base de datos con datos de ejemplo.
seed:
	cd backend && $(BACKEND_PYTHON) seed.py

## preview: levanta en local el stack completo con las imagenes de produccion
## (PostgreSQL + backend + frontend) y los valores del .env, como prueba de
## humo. Sin hot reload, sin volumenes con el codigo y sin root: son las mismas
## imagenes que se desplegarian. La SPA queda en http://localhost:3000 y la API
## en http://localhost:8000. Usa siempre el .env y la etiqueta :latest, nunca
## las imagenes de otro entorno.
##
## Arranca en background: la terminal queda libre en vez de quedarse enganchada
## a los logs de los tres contenedores. Para verlos, desde infra/:
## docker compose --env-file ../.env --profile prod logs -f
preview: export IMAGE_TAG := latest
preview:
	cd infra && docker compose --env-file ../.env --profile prod up -d --build
	@echo Stack de produccion levantado en local:
	@echo   SPA en http://localhost:3000
	@echo   API en http://localhost:8000/docs

## build: construye las imagenes de produccion de backend y frontend a traves
## de compose, con los valores del env-file, y no arranca nada. Sin ENV lee el
## .env y las etiqueta como :latest; con ENV=<entorno> (make build ENV=staging)
## lee el .env.<entorno> y las etiqueta como :<entorno>, para que las de un
## entorno no pisen las de otro.
##
## Las de otro entorno solo sirven para comprobar que el build funciona con sus
## valores: no se arrancan en local, porque el navegador llamaria a la API de
## ese entorno y su CORS rechazaria las peticiones. Ni este comando ni ningun
## otro las publica en un registro ni las despliega.
build: export IMAGE_TAG := $(BUILD_TAG)
build:
	cd infra && docker compose --env-file ../$(BUILD_ENV_FILE) --profile prod build
	@echo Imagenes construidas con $(BUILD_ENV_FILE): fastapi-template:$(BUILD_TAG) y react-template:$(BUILD_TAG)
