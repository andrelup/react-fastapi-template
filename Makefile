.PHONY: dev test test-back test-front test-e2e lint migrate seed build

## dev: levanta todo el entorno (PostgreSQL + backend con hot reload) via Docker Compose.
dev:
	cd infra && docker compose --env-file ../.env up --build

## test: suite completa. Por ahora solo hay tests de backend cableados;
## test-front/test-e2e se activaran en tareas futuras.
test: test-back

## test-back: tests del backend (pytest) con reporte de cobertura.
test-back:
	cd backend && python -m pytest --cov=src --cov-report=term-missing

## test-front: placeholder hasta que el frontend tenga suite de tests
## configurada (ver issue futura). No debe romper `make test`.
test-front:
	@echo "test-front: aun no hay suite de tests configurada en frontend/ (pendiente)"

## test-e2e: placeholder hasta que se configure Playwright.
test-e2e:
	@echo "test-e2e: aun no hay tests end-to-end configurados (pendiente)"

## lint: ruff check + mypy en backend, eslint en frontend.
lint:
	cd backend && python -m ruff check . && python -m mypy .
	cd frontend && npm run lint

## migrate: aplica las migraciones de Alembic hasta la ultima revision.
migrate:
	cd backend && alembic upgrade head

## seed: pobla la base de datos con datos de ejemplo.
seed:
	cd backend && python seed.py

## build: construye las imagenes Docker de backend y frontend.
## frontend/Dockerfile aun no existe (llegara en una tarea futura); mientras
## tanto este target solo construye la imagen de backend sin romper `make`.
build:
	docker build -t bookshelf-backend ./backend
	@if [ -f frontend/Dockerfile ]; then \
		docker build -t bookshelf-frontend ./frontend; \
	else \
		echo "build: frontend/Dockerfile aun no existe (pendiente)"; \
	fi
